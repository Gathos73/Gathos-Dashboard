import type { ApiKeyRecord, DashboardUser } from "./types";

export function canUseProduct(user: DashboardUser, product: string): boolean {
  return user.access_active === true && Boolean(user.product_codes?.includes(product));
}

export function keyMatchesProduct(key: ApiKeyRecord, product: string): boolean {
  const keyProduct = key.type === "image_gen" ? "image" : key.type;
  if (key.scope === "all_entitled" || key.type === "unknown") {
    return Boolean(key.product_codes?.includes(product));
  }
  return keyProduct === product && (!key.product_codes || key.product_codes.includes(product));
}
