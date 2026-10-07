import type { ApiKeyRecord, CatalogProduct, DashboardUser } from "./types";

export function keyProducts(user: DashboardUser, keys: ApiKeyRecord[]): CatalogProduct[] {
  const catalog = new Map((user.products ?? []).map((product) => [product.code, product]));
  // Include historical keys even after a product leaves the current catalog.
  for (const key of keys) {
    const codes = key.product_codes ?? [key.type === "image_gen" ? "image" : key.type];
    for (const code of codes) {
      if (code !== "unknown" && !catalog.has(code)) catalog.set(code, {
        code, name: key.product_name || code, available: !user.products,
      });
    }
  }
  // Support account payloads from older backends without a static product list.
  if (!user.products) for (const code of user.product_codes ?? []) {
    if (!catalog.has(code)) catalog.set(code, { code, name: code });
  }
  return [...catalog.values()];
}

export function canCreateProductKey(user: DashboardUser, code: string): boolean {
  return user.access_active === true && Boolean(user.product_codes?.includes(code))
    && (!user.products || user.products.some((product) => product.code === code && product.available !== false));
}
