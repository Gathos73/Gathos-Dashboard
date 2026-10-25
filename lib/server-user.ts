import { cookieName } from "@/lib/cookie-names";
import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_USER } from "@/lib/demo-data";
import { verifySession } from "@/lib/session-token";
import type { DashboardUser } from "@/lib/types";

type MeResponse = { user?: DashboardUser | null };

export function getBackendUrl(): string {
  return (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
}

export function isDemoMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DASHBOARD_DEMO_MODE === "true";
}

export async function getServerDashboardData<T>(path: string): Promise<T | null> {
  if (isDemoMode()) return null;
  const token = (await cookies()).get(cookieName("gathos_session"))?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${getBackendUrl()}/api/${path.replace(/^\/+/, "")}`, {
      cache: "no-store",
      headers: { cookie: `${cookieName("gathos_session")}=${encodeURIComponent(token)}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<DashboardUser | null> => {
  if (isDemoMode()) return DEMO_USER;

  const token = (await cookies()).get(cookieName("gathos_session"))?.value;
  if (!token) return null;
  const secret = process.env.SESSION_SECRET;
  const identity = secret ? verifySession(token, secret) : null;
  if (secret && !identity) return null;
  // A valid signature does not prove current access. React cache deduplicates
  // this check only within the current server render, never across requests.
  return (async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
        cache: "no-store",
        headers: { cookie: `${cookieName("gathos_session")}=${encodeURIComponent(token)}` },
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
    } catch (error) {
      throw new Error("Account details are temporarily unavailable. Please retry.", { cause: error });
    }
  })();
});

// Layouts must observe revocation just like data APIs.
export const getSessionUser = getCurrentUser;

export async function requireUser(): Promise<DashboardUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSessionUser(): Promise<DashboardUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
