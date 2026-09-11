import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountCache } from '../lib/account-cache.ts';

test('deduplicates within a session, isolates sessions, expires and bounds entries', async () => {
  let time = 0;
  let calls = 0;
  const cache = createAccountCache(30, 2, () => time);
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.read('a', load), cache.read('a', load)]), [1, 1]);
  assert.equal(await cache.read('b', load), 2);
  assert.equal(await cache.read('a', load), 1);
  time = 30;
  assert.equal(await cache.read('a', load), 3);
  await cache.read('c', load);
  assert.equal(await cache.read('b', load), 5);
});
test('invalidation cannot be undone by a pending read', async () => {
  const cache = createAccountCache();
  let resolve;
  const pending = cache.read('a', () => new Promise(r => { resolve = r; }));
  await Promise.resolve();
  cache.invalidate('a');
  assert.equal(await cache.read('a', async () => 'fresh'), 'fresh');
  resolve('stale');
  assert.equal(await pending, 'stale');
  assert.equal(await cache.read('a', async () => 'wrong'), 'fresh');
});
test('does not retain failures, missing accounts, or unverified reads', async () => {
  const cache = createAccountCache();
  await assert.rejects(cache.read('a', async () => { throw new Error('offline'); }));
  assert.equal(await cache.read('a', async () => null), null);
  assert.equal(await cache.read('a', async () => 'loaded'), 'loaded');
  assert.equal(await cache.read('a', async () => 'live', false), 'live');
  cache.invalidate('a');
  assert.equal(await cache.read('a', async () => 'updated'), 'updated');
});
