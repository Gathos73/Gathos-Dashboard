import { getServerDashboardData, isDemoMode, requireSessionUser } from "@/lib/server-user";
import { PrioritySupportClient } from "@/components/priority-support-client";
import type { PrioritySupportTicket } from "@/lib/types";

export default async function PrioritySupportPage() {
  const user = await requireSessionUser();
  const hasPrioritySupport = Boolean(user.priority_support || user.plan_details?.priority_support);
  const payload = hasPrioritySupport
    ? await getServerDashboardData<{ tickets: PrioritySupportTicket[] }>("priority-support")
    : null;
  return (
    <PrioritySupportClient
      demo={isDemoMode()}
      initialTickets={payload?.tickets}
      user={user}
    />
  );
}
