import type { Metadata } from "next";

import { PlaygroundClient } from "@/components/playground-client";
import { getServerDashboardData, isDemoMode, requireUser } from "@/lib/server-user";
import type { ApiKeyRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Playground" };

export default async function PlaygroundPage() {
  const [user, payload] = await Promise.all([
    requireUser(),
    getServerDashboardData<{ keys?: ApiKeyRecord[] }>("auth/keys"),
  ]);
  return <PlaygroundClient demo={isDemoMode()} initialKeys={payload?.keys} user={user} />;
}
