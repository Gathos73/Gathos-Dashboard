import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyMatchesProduct } from '../lib/access.ts';

test('legacy image keys stay in Image even when their grants include video', () => {
  const key = { type: 'image_gen', scope: 'selected_products', product_codes: ['image', 'video'] };
  assert.equal(keyMatchesProduct(key, 'image'), true);
  assert.equal(keyMatchesProduct(key, 'video'), false);
  assert.equal(keyMatchesProduct(key, 'tts'), false);
});

test('service keys match only their category, including older payloads', () => {
  for (const [type, product] of [['image_gen', 'image'], ['video', 'video'], ['tts', 'tts'], ['image2image', 'image2image']]) {
    for (const candidate of ['image', 'video', 'tts', 'image2image']) {
      assert.equal(keyMatchesProduct({ type }, candidate), candidate === product);
      assert.equal(keyMatchesProduct({ type, product_codes: [product] }, candidate), candidate === product);
    }
  }
});

test('explicit grants still restrict service-specific keys', () => {
  assert.equal(keyMatchesProduct({ type: 'image_gen', product_codes: [] }, 'image'), false);
  assert.equal(keyMatchesProduct({ type: 'video', product_codes: ['image'] }, 'video'), false);
});

test('general-purpose keys use their product grants', () => {
  for (const key of [
    { type: 'image_gen', scope: 'all_entitled', product_codes: ['image', 'video'] },
    { type: 'unknown', scope: 'selected_products', product_codes: ['image', 'video'] },
  ]) {
    assert.equal(keyMatchesProduct(key, 'image'), true);
    assert.equal(keyMatchesProduct(key, 'video'), true);
    assert.equal(keyMatchesProduct(key, 'tts'), false);
  }
  assert.equal(keyMatchesProduct({ type: 'unknown' }, 'video'), false);
});
