import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server-user";
import { selectedCheckout } from "@/lib/purchase";
import { PaymentSuccess } from "./payment-success";

export const metadata: Metadata = { title: "Payment confirmation" };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const checkout = selectedCheckout((await searchParams).checkout);
  if (!checkout) redirect("/subscription");
  const user = await getCurrentUser();
  if (!user) redirect("/login?checkout=" + encodeURIComponent(checkout));
  return <PaymentSuccess checkout={checkout} />;
}
