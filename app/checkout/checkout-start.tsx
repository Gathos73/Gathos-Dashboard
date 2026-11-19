"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DashboardApiError, dashboardRequest, jsonRequest } from "@/lib/client-api";

type CheckoutResponse = { url?: string; checkout_id: string; completed?: boolean };

export function CheckoutStart({ plan, userId, cancelled }: { plan: string; userId: string; cancelled: boolean }) {
  const pending = useRef<Promise<CheckoutResponse> | null>(null);
  const requestId = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cancelled);
  const shouldStart = !cancelled || attempt > 0;

  useEffect(() => {
    if (!shouldStart) return;
    let active = true;
    const storageKey = `gathos-checkout:${userId}:${plan}`;
    if (!requestId.current) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        if (saved && typeof saved.id === "string" && Date.now() - saved.createdAt < 23 * 60 * 60 * 1000) {
          requestId.current = saved.id;
        }
      } catch {
        // A tab can still purchase when browser storage is unavailable.
      }
      if (!requestId.current) {
        requestId.current = crypto.randomUUID();
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ id: requestId.current, createdAt: Date.now() }));
        } catch {
          // The in-memory reference keeps retries stable in this page.
        }
      }
    }
    pending.current ||= dashboardRequest<CheckoutResponse>(
      "/api/auth/checkout",
      jsonRequest({ plan, request_id: requestId.current }, { method: "POST" }),
    );
    const request = pending.current;
    void request.then((result) => {
      if (!active) return;
      if (result.completed) {
        window.location.replace("/checkout/success?checkout=" + encodeURIComponent(result.checkout_id));
        return;
      }
      const target = new URL(result.url || "");
      if (target.protocol !== "https:" || target.hostname !== "checkout.dodopayments.com" || target.username || target.password) {
        throw new Error("The payment link could not be verified. Please try again.");
      }
      window.location.assign(target.toString());
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof DashboardApiError && failure.status === 401) {
        window.location.replace("/login?plan=" + encodeURIComponent(plan));
        return;
      }
      pending.current = null;
      setLoading(false);
      setError(failure instanceof Error ? failure.message : "Checkout could not be opened. Please try again.");
    });
    return () => { active = false; };
  }, [plan, userId, shouldStart, attempt]);

  function retry() {
    setError("");
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  return (
    <main className="purchase-page">
      <Link className="purchase-brand" href="/">Gathos</Link>
      <div className="purchase-content" aria-live="polite">
        <p className="eyebrow">Secure checkout</p>
        <h1>{loading ? "Opening Dodo Payments…" : cancelled ? "Payment wasn’t completed" : "Checkout needs your attention"}</h1>
        <p>{error || (loading ? "You’ll enter your payment details on Dodo Payments." : "You can return to checkout when you’re ready.")}</p>
        {!loading && <button className="button button-primary" type="button" onClick={retry}>Continue to Dodo Payments</button>}
        <Link className="purchase-secondary" href="/subscription">Manage subscription</Link>
      </div>
    </main>
  );
}
