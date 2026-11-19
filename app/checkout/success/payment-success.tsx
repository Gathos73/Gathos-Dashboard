"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { DashboardApiError, dashboardRequest } from "@/lib/client-api";
import { CheckIcon, KeyIcon, SparklesIcon } from "@/components/icons";

type PaymentStatus = { status: "pending" | "confirmed" | "failed" | "inactive"; plan_name: string };

function Confetti() {
  return (
    <div className="purchase-confetti" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => {
        const angle = 2 * Math.PI * index / 14;
        return <span key={index} style={{
          "--confetti-x": `${Math.round(Math.cos(angle) * 95)}px`,
          "--confetti-y": `${Math.round(Math.sin(angle) * 65)}px`,
          "--confetti-spin": `${index * 51}deg`,
          "--confetti-color": index % 3 === 0 ? "#bca56b" : index % 2 === 0 ? "#84b98f" : "#078a52",
        } as CSSProperties} />;
      })}
    </div>
  );
}

export function PaymentSuccess({ checkout }: { checkout: string }) {
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    async function check() {
      polls += 1;
      try {
        const result = await dashboardRequest<PaymentStatus>("/api/auth/checkout/" + encodeURIComponent(checkout), { cache: "no-store" });
        if (!active) return;
        setPayment(result);
        if (result.status !== "pending") return;
      } catch (failure) {
        if (!active) return;
        if (failure instanceof DashboardApiError && failure.status === 401) {
          window.location.replace("/login?checkout=" + encodeURIComponent(checkout));
          return;
        }
        if (failure instanceof DashboardApiError && failure.status === 404) {
          setMessage("This checkout could not be found for your account.");
          return;
        }
      }
      if (!active) return;
      if (polls >= 30) {
        setMessage("Confirmation is taking a little longer. Check again shortly.");
        return;
      }
      timer = setTimeout(check, 2000);
    }
    void check();
    return () => { active = false; clearTimeout(timer); };
  }, [checkout, attempt]);

  const confirmed = payment?.status === "confirmed";
  const inactive = payment?.status === "inactive";
  const failed = payment?.status === "failed";
  return (
    <main className="purchase-page">
      <Link className="purchase-brand" href="/">Gathos</Link>
      <div className="purchase-content" aria-live="polite">
        {confirmed ? (
          <>
            <div className="purchase-check"><CheckIcon /><Confetti /></div>
            <p className="eyebrow">Payment confirmed</p>
            <h1>Your {payment.plan_name} plan is active</h1>
            <section className="purchase-next-steps" aria-labelledby="purchase-next-heading">
              <h2 id="purchase-next-heading">Your next step</h2>
              <div className="purchase-next-grid">
                <div className="purchase-next-card">
                  <KeyIcon />
                  <h3>Connect your app</h3>
                  <p>Create an API key to start building.</p>
                  <Link className="button button-primary" href="/api-keys">Open API keys</Link>
                </div>
                {/* <div className="purchase-next-card">
                  <SparklesIcon />
                  <h3>Try the Playground</h3>
                  <p>Make your first image, video, or audio.</p>
                  <Link className="button button-secondary" href="/playground">Open Playground</Link>
                </div> */}
              </div>
            </section>
          </>
        ) : (
          <>
            <p className="eyebrow">{inactive ? "Subscription updated" : failed ? "Checkout unavailable" : "Payment confirmation"}</p>
            <h1>{inactive ? "This purchase is no longer active" : failed ? "Checkout could not be completed" : "Confirming your payment…"}</h1>
            <p>{message || (inactive || failed ? "Review your current subscription for details." : "Your plan will be ready once payment is confirmed.")}</p>
            {message && <button type="button" className="button button-primary" onClick={() => { setMessage(""); setAttempt((value) => value + 1); }}>Check again</button>}
            <Link className="purchase-secondary" href="/subscription">View subscription</Link>
          </>
        )}
      </div>
    </main>
  );
}
