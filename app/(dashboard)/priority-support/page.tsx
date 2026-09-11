import { isDemoMode, requireUser } from "@/lib/server-user";
import { PrioritySupportClient } from "@/components/priority-support-client";

export default async function PrioritySupportPage() {
  const user = await requireUser();
  return <PrioritySupportClient demo={isDemoMode()} user={user} />;
}
