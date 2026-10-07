import assert from "node:assert/strict";
import { test } from "node:test";
import { keyProducts, canCreateProductKey } from "../lib/products.ts";

const products = [{ code: "stt", name: "Speech to Text" }, { code: "new_product", name: "Future product" }];
const user = { products, access_active: true, product_codes: ["stt", "new_product"] };

test("new catalog codes and names reach the key selector without source changes", () => {
  assert.deepEqual(keyProducts(user, []), products);
  assert.equal(canCreateProductKey(user, "stt"), true);
  assert.equal(canCreateProductKey(user, "new_product"), true);
  assert.equal(canCreateProductKey({ ...user, access_active: false }, "stt"), false);
  assert.equal(canCreateProductKey({ ...user, product_codes: ["stt"] }, "new_product"), false);
});

test("historical keys remain visible but unavailable for creation", () => {
  const rows = keyProducts(user, [{ type: "retired", product_codes: ["retired"], product_name: "Historical product" }]);
  assert.deepEqual(rows.at(-1), { code: "retired", name: "Historical product", available: false });
  assert.equal(canCreateProductKey({ ...user, product_codes: ["retired"] }, "retired"), false);
});

test("legacy image aliases and older account payloads are supported", () => {
  const rows = keyProducts({ access_active: true, product_codes: ["stt"] }, [{ type: "image_gen" }]);
  assert.deepEqual(rows.map((row) => row.code), ["image", "stt"]);
});
