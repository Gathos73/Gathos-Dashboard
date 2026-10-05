"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dashboardRequest, DashboardApiError } from "@/lib/client-api";
import type { DashboardUser } from "@/lib/types";

type AccountContext = {
  user: DashboardUser;
  refresh: () => Promise<DashboardUser | null>;
  update: (user: DashboardUser) => void;
};
const Context = createContext<AccountContext | null>(null);
const REFRESH_MS = 5 * 60_000;

// Kept in the mounted layout, never localStorage; every backend operation still
// checks its own authorization. Navigation reuses this presentation snapshot.
export function DashboardAccountProvider({ initialUser, demo, children }: {
  initialUser: DashboardUser; demo: boolean; children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [error, setError] = useState("");
  const router = useRouter();
  const loadedAt = useRef(0);
  const pending = useRef<Promise<DashboardUser | null> | null>(null);
  const update = useCallback((account: DashboardUser) => {
    if (account.userId !== initialUser.userId) return;
    loadedAt.current = Date.now();
    setUser(account);
    setError("");
  }, [initialUser.userId]);
  const refresh = useCallback((): Promise<DashboardUser | null> => {
    if (demo) return Promise.resolve(initialUser);
    if (pending.current) return pending.current;
    const request = dashboardRequest<{ user?: DashboardUser | null }>("/api/auth/me")
      .then((result) => {
        if (!result.user || result.user.userId !== initialUser.userId) {
          router.replace("/login");
          return null;
        }
        update(result.user);
        return result.user;
      })
      .catch((cause: unknown) => {
        if (cause instanceof DashboardApiError && cause.status === 401) router.replace("/login");
        else setError("Account details could not be refreshed. Your last account information is still displayed.");
        return null;
      })
      .finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [demo, initialUser, router, update]);
  useEffect(() => {
    function refreshIfStale() {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current >= REFRESH_MS) void refresh();
    }
    refreshIfStale();
    const timer = window.setInterval(refreshIfStale, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [refresh]);
  return <Context.Provider value={{ user, refresh, update }}>
    {error ? <div className="inline-notice inline-notice--danger" role="status">{error} <button className="text-button" onClick={() => void refresh()}>Retry</button></div> : null}
    {children}
  </Context.Provider>;
}

export function useDashboardAccount(fallback: DashboardUser): AccountContext {
  const account = useContext(Context);
  // Supports isolated previews; production dashboard pages always use Context.
  const update = useCallback(() => {}, []);
  const refresh = useCallback(async () => fallback, [fallback]);
  return account || { user: fallback, refresh, update };
}
