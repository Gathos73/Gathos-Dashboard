import type { ApiKeyRecord, DashboardUser } from "./types";

export function canUseProduct(user: DashboardUser, product: string): boolean {
  return user.access_active === true && Boolean(user.product_codes?.includes(product));
}

export function keyMatchesProduct(key: ApiKeyRecord, product: string): boolean {
  if (key.product_codes) return key.product_codes.includes(product);
  if (key.scope !== "all_entitled" && key.type !== "unknown") {
    const keyProduct = key.type === "image_gen" ? "image" : key.type;
    return keyProduct === product;
  }
  return (key.type === "image_gen" ? "image" : key.type) === product;
}
