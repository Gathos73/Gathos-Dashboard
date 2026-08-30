import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { isDemoMode, requireUser } from "@/lib/server-user";

export default async function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <DashboardShell demo={isDemoMode()} user={user}>{children}</DashboardShell>;
}
