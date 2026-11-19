const PLAN_CODE = /^[a-z][a-z0-9_]{1,79}$/;
const CHECKOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function selectedPlan(value: string | undefined): string | null {
  return typeof value === "string" && PLAN_CODE.test(value) ? value : null;
}

export function selectedCheckout(value: string | undefined): string | null {
  return typeof value === "string" && CHECKOUT_ID.test(value) ? value : null;
}

export function purchaseDestination(plan: string | null, checkout: string | null = null): string {
  if (checkout) return `/checkout/success?checkout=${encodeURIComponent(checkout)}`;
  return plan ? `/checkout?plan=${encodeURIComponent(plan)}` : "/";
}
