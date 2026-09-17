import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { isDemoMode, requireSessionUser } from "@/lib/server-user";

export default async function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser();
  return <DashboardShell demo={isDemoMode()} user={user}>{children}</DashboardShell>;
}
