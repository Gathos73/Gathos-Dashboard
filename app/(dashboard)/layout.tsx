import type { ReactNode } from "react";

import { DashboardAccountProvider } from "@/components/dashboard-account";
import { DashboardShell } from "@/components/dashboard-shell";
import { isDemoMode, requireSessionUser } from "@/lib/server-user";

export default async function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser();
  return <DashboardAccountProvider initialUser={user} demo={isDemoMode()}><DashboardShell demo={isDemoMode()} user={user}>{children}</DashboardShell></DashboardAccountProvider>;
}
