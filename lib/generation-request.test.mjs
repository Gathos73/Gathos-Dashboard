import assert from "node:assert/strict";
import test from "node:test";
import { requestFingerprint, retainedIdentity } from "./generation-request.mjs";

const file = (text) => ({ arrayBuffer: async () => new TextEncoder().encode(text).buffer });

test("a lost response keeps the original identity for unchanged inputs", async () => {
  const fingerprint = await requestFingerprint("image", {prompt:"same"}, "key-id", []);
  const saved = {fingerprint, key:"original-request"};
  assert.equal(retainedIdentity(fingerprint, saved, () => "duplicate"), "original-request");
  assert.equal(retainedIdentity(fingerprint, null, () => "intentional-new-run"), "intentional-new-run");
});

test("different bytes with equal name/length receive a new identity", async () => {
  const before = await requestFingerprint("image2image", {prompt:"edit"}, "key-id", [["image",file("abc")]]);
  const after = await requestFingerprint("image2image", {prompt:"edit"}, "key-id", [["image",file("xyz")]]);
  assert.notEqual(before, after);
  assert.equal(retainedIdentity(after, {fingerprint:before,key:"old"}, () => "new"), "new");
});

test("product, fields and selected key all belong to request identity", async () => {
  const original = await requestFingerprint("image", {prompt:"one"}, "key-1", []);
  for (const args of [["video",{prompt:"one"},"key-1"],["image",{prompt:"two"},"key-1"],["image",{prompt:"one"},"key-2"]]) {
    assert.notEqual(original, await requestFingerprint(...args, []));
  }
});
