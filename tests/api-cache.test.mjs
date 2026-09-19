import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { clearRequestCache } from '../lib/request-cache.ts';

const source = await readFile(new URL('../lib/client-api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('"./request-cache"', JSON.stringify(new URL('../lib/request-cache.ts', import.meta.url).href));
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('Cloudflare HTML errors produce actionable messages without retrying submissions', async (t) => {
  const html = '<!DOCTYPE html><html><head><title>gathos.live | 502: Bad gateway</title></head><body>Host Error</body></html>';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(html, { status: 502, headers: { 'content-type': 'text/html' } });
  });
  await assert.rejects(api.dashboardRequest('/api/playground/image', { method: 'POST' }), (error) => {
    assert.ok(error instanceof api.DashboardApiError);
    assert.equal(error.status, 502);
    assert.match(error.message, /HTTP 502/);
    assert.match(error.message, /Check Generations before submitting again/);
    assert.doesNotMatch(error.message, /<html|<!DOCTYPE/);
    return true;
  });
  assert.equal(calls, 1);
});

test('HTML detection works without content type and empty gateway errors stay readable', async (t) => {
  for (const body of ['<!DOCTYPE html><html>Bad gateway</html>', '']) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 504 }));
    await assert.rejects(api.dashboardRequest('/api/playground/tts', { method: 'POST' }), /HTTP 504.*Check Generations/);
  }
});

test('JSON errors retain their message and retry metadata, including null error bodies', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Queue full', retry_after_seconds: 30 }, { status: 503 }));
  await assert.rejects(api.dashboardRequest('/api/playground/video', { method: 'POST' }), (error) => {
    assert.equal(error.message, 'Queue full');
    assert.equal(error.retryAfterSeconds, 30);
    return true;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json(null, { status: 502 }));
  await assert.rejects(api.dashboardRequest('/api/playground/video', { method: 'POST' }), api.DashboardApiError);
});

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
