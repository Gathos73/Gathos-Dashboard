import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { verifySession } from '../lib/session-token.ts';
import { createAccountCache } from '../lib/account-cache.ts';

const source = await readFile(new URL('../lib/server-user.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

test('reuses verified accounts, checks expiry before cache, and supports backend fallback', async (t) => {
  const original = { ...process.env };
  process.env.SESSION_SECRET = 'test-secret';
  process.env.DASHBOARD_DEMO_MODE = 'false';
  t.after(() => {
    for (const key of ['SESSION_SECRET', 'DASHBOARD_DEMO_MODE']) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  });
  let now = 150_000;
  t.mock.method(Date, 'now', () => now);
  const data = JSON.stringify({
    userId: 'one', email: 'one@example.com', name: 'One', plan: 'pro',
    priority_support: true, is_superuser: false, iat: 100, exp: 160,
  });
  const valid = Buffer.from(JSON.stringify({ data, signature: createHmac('sha256', 'test-secret').update(data).digest('hex') })).toString('base64url');
  let token;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ user: { userId: 'one', email: 'one@example.com', name: 'One', plan: 'pro' } });
  });
  const dependencies = {
    'server-only': {}, react: { cache: fn => fn },
    'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/demo-data': {}, '@/lib/session-token': { verifySession },
    '@/lib/server-account-cache': { accountCache: createAccountCache() },
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    assert.ok(id in dependencies, id); return dependencies[id];
  }, loaded, loaded.exports);
  const { getCurrentUser, getSessionUser } = loaded.exports;
  assert.equal(await getCurrentUser(), null);
  token = 'invalid';
  assert.equal(await getCurrentUser(), null);
  assert.equal(calls, 0);
  token = valid;
  assert.equal((await getCurrentUser()).userId, 'one');
  assert.equal((await getCurrentUser()).userId, 'one');
  assert.equal(calls, 1);
  assert.deepEqual(await getSessionUser(), {
    userId: 'one', email: 'one@example.com', name: 'One', avatar: undefined,
    plan: 'pro', priority_support: true, is_superuser: false,
  });
  assert.equal(calls, 1);
  now = 160_000;
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getSessionUser(), null);
  assert.equal(calls, 1);
  delete process.env.SESSION_SECRET;
  await getCurrentUser();
  await getCurrentUser();
  assert.equal(calls, 3);
});
