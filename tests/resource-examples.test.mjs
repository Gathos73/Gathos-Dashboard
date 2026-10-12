import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REQUEST_EXAMPLES, EXAMPLE_LANGUAGES, requestExample } from '../lib/resource-examples.ts';

for (const [name, example] of Object.entries(REQUEST_EXAMPLES)) {
  test(`${name}: copyable examples have valid shell, Python, and JavaScript syntax`, () => {
    execFileSync('bash', ['-n'], { input: requestExample(example, EXAMPLE_LANGUAGES[0]) });
    execFileSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], { input: requestExample(example, EXAMPLE_LANGUAGES[1]) });
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: requestExample(example, EXAMPLE_LANGUAGES[2]) });
  });
}

for (const name of ['stt', 'sttUpload']) {
  test(`${name}: Node example submits the public contract and polls the generation route`, async () => {
    const code = requestExample(REQUEST_EXAMPLES[name], 'JavaScript (Node.js)').replace(/^import .*;$/m, '');
    const requests = [];
    const writes = [];
    const execute = Object.getPrototypeOf(async function () {}).constructor('process', 'fetch', 'readFile', 'writeFile', 'console', code);
    await execute({ env: { GATHOS_STT_KEY: 'test-key', GATHOS_STT_REQUEST_ID: 'recording-1' } }, async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => options.method === 'POST'
        ? { generation_id: 'generation-1', status: 'queued' }
        : { generation_id: 'generation-1', status: 'succeeded', transcript: 'Hello' } };
    }, async () => Buffer.from('audio'), async (...args) => writes.push(args), { log() {} });
    assert.equal(requests[0].options.headers['Idempotency-Key'], 'recording-1');
    assert.equal(requests[1].url, 'https://api.gathos.live/api/v1/stt/jobs/generation-1');
    assert.equal(writes[0][0], 'result.json');
    assert.equal(JSON.parse(writes[0][1]).status, 'succeeded');
    if (name === 'sttUpload') {
      assert.equal(requests[0].options.body.get('formats'), 'json,txt,srt,csv');
      assert.equal(requests[0].options.body.get('timestamps'), 'true');
      assert.equal(requests[0].options.body.get('file').name, 'recording.wav');
      assert.equal(requests[0].options.headers['Content-Type'], undefined);
    } else {
      assert.deepEqual(JSON.parse(requests[0].options.body).formats, ['json', 'txt', 'srt', 'csv']);
    }
  });
}

for (const name of ['video', 'conditionedVideo']) {
  test(`${name}: polling stops on the video API's done response`, async () => {
    const code = requestExample(REQUEST_EXAMPLES[name], 'JavaScript (Node.js)').replace(/^import .*;$/m, '');
    const writes = [];
    let polls = 0;
    const execute = Object.getPrototypeOf(async function () {}).constructor('process', 'fetch', 'readFile', 'writeFile', 'console', code);
    await execute({ env: { GATHOS_VIDEO_KEY: 'test-key' } }, async (url, options) => {
      if (options.method === 'POST') return { ok: true, json: async () => ({ job_id: 'video-1', status: 'queued' }) };
      assert.equal(++polls, 1, 'must stop after receiving done');
      return { ok: true, json: async () => ({ job_id: 'video-1', status: 'done', video_url: 'https://example.com/video.mp4' }) };
    }, async () => Buffer.from('image'), async (...args) => writes.push(args), { log() {} });
    assert.equal(JSON.parse(writes[0][1]).status, 'done');
    assert.match(requestExample(REQUEST_EXAMPLES[name], 'Python (requests)'), /job\["status"\] == "done"/);
    assert.match(requestExample(REQUEST_EXAMPLES[name], 'Bash (curl)'), /done\) printf/);
  });
}

test('rendered STT documentation includes the public workflow without model references', () => {
  const source = readFileSync(new URL('../components/resources-client.tsx', import.meta.url), 'utf8') + '\nexport { DocArticle };';
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const require = createRequire(import.meta.url);
  const exports = {};
  vm.runInNewContext(output, { exports, require: (id) => {
    if (id === '@/lib/resource-examples') return { REQUEST_EXAMPLES, EXAMPLE_LANGUAGES, requestExample, API_BASE: 'https://api.gathos.live/api/v1' };
    if (id === '@/components/icons') return new Proxy({}, { get: () => () => null });
    if (id === '@/components/page-header') return { PageHeader: () => null };
    return require(id);
  } });
  const html = renderToStaticMarkup(React.createElement(exports.DocArticle, { section: 'stt' }));
  assert.match(html, /Speech to Text/);
  assert.match(html, /Idempotency-Key/);
  assert.match(html, /generation_id/);
  assert.match(html, /\/stt\/upload/);
  assert.match(html, /\/artifacts\//);
  assert.doesNotMatch(html, /model|provider|adapter|service_version/i);
  for (const name of ['stt', 'sttUpload']) for (const language of EXAMPLE_LANGUAGES) {
    assert.doesNotMatch(requestExample(REQUEST_EXAMPLES[name], language), /model|provider|adapter|service_version/i);
  }
});
