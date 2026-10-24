import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/server-user.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

test('layout rechecks a copied signed cookie and fails closed after revocation', async (t) => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'isolated-test-secret';
  t.after(() => previous === undefined ? delete process.env.SESSION_SECRET : process.env.SESSION_SECRET = previous);
  let allowed = true;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return allowed ? Response.json({ user: { userId: 'u1', email: 'test@example.test', name: 'Test' } })
      : Response.json({ error: 'unauthorized' }, { status: 401 });
  });
  const dependencies = {
    'server-only': {}, react: { cache: fn => fn },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'same-copied-cookie' }) }) },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/cookie-names': { cookieName: name => name },
    '@/lib/demo-data': { DEMO_USER: {} },
    '@/lib/session-token': { verifySession: () => ({ userId: 'u1', email: 'test@example.test' }) },
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    assert.ok(id in dependencies, id); return dependencies[id];
  }, loaded, loaded.exports);
  assert.equal((await loaded.exports.getSessionUser()).userId, 'u1');
  allowed = false;
  assert.equal(await loaded.exports.getSessionUser(), null);
  assert.equal(calls, 2);
  await assert.rejects(loaded.exports.requireSessionUser(), /redirect/);
});
