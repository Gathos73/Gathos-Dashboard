import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/api/[...path]/route.ts', import.meta.url), 'utf8');
const modules = {
  '@/lib/client-address': 'export function signClientAddress() {}',
  '@/lib/cookie-names': 'export const cookieName = (name) => name',
  '@/lib/server-user': 'export const getBackendUrl = () => "http://backend.test"',
  '@/lib/server-account-cache': 'export const accountCache = { invalidate() {} }',
  '@/lib/asset-download': 'export const resolveAssetDownload = async (response) => response',
};
let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [name, code] of Object.entries(modules)) {
  compiled = compiled.replaceAll(JSON.stringify(name), JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`));
}
const route = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function request(method, origin = 'http://dashboard.test') {
  const req = new Request('http://dashboard.test/api/otp/forgot-password', {
    method,
    headers: { origin, 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ email: 'user@example.test', newPassword: 'test-new-password', verification_token: 'verified-proof' }) } : {}),
  });
  req.nextUrl = new URL(req.url);
  req.cookies = { get() {} };
  return req;
}
const context = { params: Promise.resolve({ path: ['otp', 'forgot-password'] }) };

test('password recovery forwards the verified reset body through the dashboard proxy', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'http://backend.test/api/otp/forgot-password');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), {
      email: 'user@example.test', newPassword: 'test-new-password', verification_token: 'verified-proof',
    });
    return Response.json({ ok: true });
  });
  const response = await route.POST(request('POST'), context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('password recovery remains POST-only and rejects cross-origin requests', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not forward'); });
  assert.equal((await route.GET(request('GET'), context)).status, 404);
  assert.equal((await route.POST(request('POST', 'https://untrusted.test'), context)).status, 403);
});
