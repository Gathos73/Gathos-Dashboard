import { isDemoMode, requireSessionUser } from "@/lib/server-user";
import { PrioritySupportClient } from "@/components/priority-support-client";

export default async function PrioritySupportPage() {
  const user = await requireSessionUser();
  return <PrioritySupportClient demo={isDemoMode()} user={user} />;
}
