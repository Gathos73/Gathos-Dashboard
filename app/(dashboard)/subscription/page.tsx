import type { Metadata } from "next";

import { SubscriptionClient } from "@/components/subscription-client";
import { requireUser } from "@/lib/server-user";

export const metadata: Metadata = { title: "Subscription" };

type SubscriptionPageProps = {
  searchParams: Promise<{ creator_upgrade?: string; subscribed?: string }>;
};

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const [user, parameters] = await Promise.all([requireUser(), searchParams]);
  const paymentTarget = parameters.creator_upgrade === "paid"
    ? "pro_plus"
    : parameters.subscribed === "true"
      ? "pro"
      : null;
  return <SubscriptionClient initialUser={user} paymentTarget={paymentTarget} />;
}
