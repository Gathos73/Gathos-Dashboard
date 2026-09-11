import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAssetDownload } from '../lib/asset-download.ts';

const signal = new AbortController().signal;
test('streams a signed output without forwarding session credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://storage.example/output?signature=test');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  });
  const result = await resolveAssetDownload(Response.redirect('https://storage.example/output?signature=test', 307), signal);
  assert.equal(result.headers.get('content-disposition'), 'attachment');
  assert.equal(result.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [1, 2, 3]);
});
test('preserves ownership and missing-storage errors', async () => {
  const upstream = Response.json({ error: 'This output is not available in owned storage.' }, { status: 409 });
  assert.equal(await resolveAssetDownload(upstream, signal), upstream);
});
test('reports missing objects without exposing storage response details', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private storage details', { status: 404 }));
  const result = await resolveAssetDownload(Response.redirect('https://storage.example/output', 307), signal);
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: 'The output file is no longer available in storage.' });
});
test('rejects invalid storage redirects', async () => {
  const result = await resolveAssetDownload(Response.redirect('http://storage.example/output', 307), signal);
  assert.equal(result.status, 502);
});
