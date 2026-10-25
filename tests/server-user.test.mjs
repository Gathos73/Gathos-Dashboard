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
  let validSignature = true;
  let unavailable = false;
  let hasCookie = true;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (unavailable) throw new Error('backend unavailable');
    return allowed ? Response.json({ user: { userId: 'u1', email: 'test@example.test', name: 'Test' } })
      : Response.json({ error: 'unauthorized' }, { status: 401 });
  });
  const dependencies = {
    'server-only': {}, react: { cache: fn => fn },
    'next/headers': { cookies: async () => ({ get: () => hasCookie ? { value: 'same-copied-cookie' } : undefined }) },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/cookie-names': { cookieName: name => name },
    '@/lib/demo-data': { DEMO_USER: {} },
    '@/lib/session-token': { verifySession: () => validSignature ? { userId: 'u1', email: 'test@example.test' } : null },
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
  validSignature = false;
  const before = calls;
  assert.equal(await loaded.exports.getSessionUser(), null);
  assert.equal(calls, before, 'invalid/expired local proof never reaches the backend');
  delete process.env.SESSION_SECRET;
  allowed = true;
  assert.equal((await loaded.exports.getSessionUser()).userId, 'u1', 'backend fallback stays supported');
  unavailable = true;
  await assert.rejects(loaded.exports.getSessionUser(), /temporarily unavailable/);
  hasCookie = false;
  assert.equal(await loaded.exports.getSessionUser(), null);
});
