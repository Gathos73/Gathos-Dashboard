import type { ApiKeyRecord, DashboardUser } from "./types";

export function canUseProduct(user: DashboardUser, product: string): boolean {
  if (user.access_active === false) return false;
  if (user.product_codes) return user.product_codes.includes(product);
  // Older sessions and demo fixtures retain their existing display behavior.
  if (user.plan === "trial" && user.trial?.expired) return false;
  if (product === "video") return user.plan === "pro_plus" || user.plan === "business";
  return ["trial", "pro", "pro_plus", "business"].includes(user.plan);
}

export function keyMatchesProduct(key: ApiKeyRecord, product: string): boolean {
  // Legacy image keys also authorize video requests. Service-specific keys
  // belong to their own category and playground, regardless of that compatibility grant.
  if (key.scope !== "all_entitled" && key.type !== "unknown") {
    const keyProduct = key.type === "image_gen" ? "image" : key.type;
    return keyProduct === product && (!key.product_codes || key.product_codes.includes(product));
  }
  if (key.product_codes) return key.product_codes.includes(product);
  return (key.type === "image_gen" ? "image" : key.type) === product;
}
