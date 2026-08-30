import type { Metadata } from "next";

import { ApiKeysManager } from "@/components/api-keys-manager";
import { isDemoMode, requireUser } from "@/lib/server-user";

export const metadata: Metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const user = await requireUser();
  return <ApiKeysManager demo={isDemoMode()} user={user} />;
}
