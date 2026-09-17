import type { Metadata } from "next";

import { ApiKeysManager } from "@/components/api-keys-manager";
import { getServerDashboardData, isDemoMode, requireSessionUser } from "@/lib/server-user";
import type { ApiKeyRecord } from "@/lib/types";

export const metadata: Metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const [user, payload] = await Promise.all([
    requireSessionUser(),
    getServerDashboardData<{ keys?: ApiKeyRecord[] }>("auth/keys"),
  ]);
  return <ApiKeysManager demo={isDemoMode()} initialKeys={payload?.keys} user={user} />;
}
