import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server-user";
import { selectedPlan } from "@/lib/purchase";
import { CheckoutStart } from "./checkout-start";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cancelled?: string }>;
}) {
  const parameters = await searchParams;
  const plan = selectedPlan(parameters.plan);
  if (!plan) {
    return (
      <main className="purchase-page">
        <h1>Choose your plan</h1>
        <Link className="button button-primary" href={(process.env.NEXT_PUBLIC_SITE_URL || "https://gathos.com") + "/#pricing"}>View plans</Link>
      </main>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect("/login?plan=" + encodeURIComponent(plan));
  return <CheckoutStart plan={plan} userId={user.userId} cancelled={parameters.cancelled === "1"} />;
}
