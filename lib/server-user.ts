import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_USER } from "@/lib/demo-data";
import { verifySession } from "@/lib/session-token";
import { accountCache } from "@/lib/server-account-cache";
import type { DashboardUser } from "@/lib/types";

type MeResponse = { user?: DashboardUser | null };

export function getBackendUrl(): string {
  return (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
}

export function isDemoMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DASHBOARD_DEMO_MODE === "true";
}

export const getCurrentUser = cache(async (): Promise<DashboardUser | null> => {
  if (isDemoMode()) return DEMO_USER;

  const token = (await cookies()).get("gathos_session")?.value;
  if (!token) return null;
  const secret = process.env.SESSION_SECRET;
  const identity = secret ? verifySession(token, secret) : null;
  if (secret && !identity) return null;
  // Cache account presentation only after local verification. Backend APIs still
  // authorize every protected operation against their current account state.
  return accountCache.read(token, async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
        cache: "no-store",
        headers: { cookie: `gathos_session=${encodeURIComponent(token)}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
      const payload = (await response.json()) as MeResponse;
      if (!payload.user?.email || !payload.user.userId) return null;
      return {
        ...payload.user,
        name: payload.user.name?.trim() || payload.user.email.split("@")[0] || "Gathos user",
      };
    } catch {
      return null;
    }
  }, Boolean(identity));
});

export async function requireUser(): Promise<DashboardUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
