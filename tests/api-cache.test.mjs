import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { clearRequestCache } from '../lib/request-cache.ts';

const source = await readFile(new URL('../lib/client-api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('"./request-cache"', JSON.stringify(new URL('../lib/request-cache.ts', import.meta.url).href));
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('API reads cache across navigation and mutations invalidate them', async (t) => {
  globalThis.window = {};
  t.after(() => { delete globalThis.window; clearRequestCache(); });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ version: ++calls }));
  const read = () => api.dashboardRequest("/api/auth/usage?days=30");
  assert.equal((await read()).version, 1);
  assert.equal((await read()).version, 1);
  await api.dashboardRequest("/api/voices/example", { method: "DELETE" });
  assert.equal((await read()).version, 3);
  clearRequestCache();
  assert.equal((await read()).version, 4);
});

test('polls and auth checks remain fresh while generation navigation uses cached results', async (t) => {
  globalThis.window = {};
  t.after(() => { delete globalThis.window; clearRequestCache(); });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ version: ++calls }));
  for (const url of ['/api/auth/me', '/api/playground/jobs/image/123?poll_token=abc', '/api/voices/123/url']) {
    assert.notEqual((await api.dashboardRequest(url)).version, (await api.dashboardRequest(url)).version);
  }
  const path = '/api/generations?limit=25';
  const initial = await api.dashboardRequest(path);
  assert.deepEqual(await api.dashboardRequest(path), initial);
  const polled = await api.dashboardRequest(path, { cache: 'reload' });
  assert.notDeepEqual(polled, initial);
  assert.deepEqual(await api.dashboardRequest(path), polled);
});
