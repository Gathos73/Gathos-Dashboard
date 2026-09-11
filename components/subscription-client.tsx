"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { CardIcon, CheckIcon, SparklesIcon, VoiceIcon, WarningIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SubscriptionDetails } from "@/components/subscription-details";
import { dashboardRequest } from "@/lib/client-api";
import type { DashboardUser, Plan } from "@/lib/types";

type CheckoutResponse = {
  changed?: boolean;
  message?: string;
  pendingPayment?: boolean;
  url?: string;
};

type MeResponse = { user?: DashboardUser | null };
type AvailablePlan = { code: string; display_name: string; description: string | null; price_minor: number; currency: string; billing_interval: string; products: string[]; is_downgrade: boolean };
function formatPlanPrice(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return formatter.format(amount / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

const PLAN_DETAILS: Record<string, { label: string; price: string; cadence: string }> = {
  free: { label: "Free", price: "$0", cadence: "forever" },
  trial: { label: "Trial", price: "$0", cadence: "for 7 days" },
  pro: { label: "Pro", price: "$18", cadence: "per month" },
  pro_plus: { label: "Creator", price: "$45", cadence: "per month" },
  business: { label: "Business", price: "Custom", cadence: "agreement" },
  starter: { label: "Starter", price: "Custom", cadence: "plan" },
  scale: { label: "Scale", price: "Custom", cadence: "plan" },
} satisfies Record<Plan, { cadence: string; label: string; price: string }>;

export function SubscriptionClient({
  initialUser,
  paymentTarget,
}: {
  initialUser: DashboardUser;
  paymentTarget: string | null;
}) {
  const [user, setUser] = useState(initialUser);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const initiallyConfirmed = Boolean(paymentTarget && initialUser.plan === paymentTarget);
  const [message, setMessage] = useState(
    paymentTarget
      ? initiallyConfirmed
        ? `${initialUser.plan_details?.display_name || PLAN_DETAILS[initialUser.plan]?.label || initialUser.plan} is active on your account.`
        : "Confirming your subscription with our billing provider…"
      : "",
  );
  const [error, setError] = useState("");
  const [planOptions, setPlanOptions] = useState<{ forPlan: string; plans: AvailablePlan[] } | null>(null);
  const availablePlans = planOptions?.forPlan === user.plan ? planOptions.plans : null;
  useEffect(() => {
    let active = true;
    void dashboardRequest<{ plans: AvailablePlan[] }>("/api/auth/plans", { cache: "no-store" })
      .then((result) => { if (active) setPlanOptions({ forPlan: user.plan, plans: result.plans }); })
      .catch(() => { if (active) { setPlanOptions({ forPlan: user.plan, plans: [] }); setError("Could not load available plans. Please refresh to try again."); } });
    return () => { active = false; };
  }, [user.plan]);

  useEffect(() => {
    if (!paymentTarget) return;
    const targetConfirmed = user.plan === paymentTarget;
    if (targetConfirmed) {
      window.history.replaceState({}, "", "/subscription");
      return;
    }

    let active = true;
    let attempts = 0;
    let timeout: number | undefined;

    async function checkPlan() {
      attempts += 1;
      try {
        const payload = await dashboardRequest<MeResponse>("/api/auth/me");
        if (!active) return;
        const refreshedPlan = payload.user?.plan;
        const refreshedTarget = refreshedPlan === paymentTarget;
        if (payload.user && refreshedTarget) {
          setUser(payload.user);
          setMessage(`${payload.user.plan_details?.display_name || PLAN_DETAILS[payload.user.plan]?.label || payload.user.plan} is now active on your account.`);
          window.history.replaceState({}, "", "/subscription");
          return;
        }
      } catch {
        // The billing webhook may win the race on a later attempt.
      }
      if (!active) return;
      if (attempts >= 30) {
        setMessage("Payment is still being confirmed. You can leave this page and check again shortly.");
        return;
      }
      timeout = window.setTimeout(checkPlan, 2000);
    }

    void checkPlan();
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [paymentTarget, user.plan]);

  async function choosePlan(target: string) {
    const selectedPlan = availablePlans?.find((plan) => plan.code === target);
    if (!selectedPlan || selectedPlan.is_downgrade || target === user.plan || loadingPlan !== null) return;
    setLoadingPlan(target);
    setError("");
    setMessage("");
    try {
      const isCreatorUpgrade = target === "pro_plus" && user.plan === "pro";
      const response = await dashboardRequest<CheckoutResponse>(
        isCreatorUpgrade ? "/api/auth/subscribe/upgrade-creator" : `/api/auth/subscribe?plan=${encodeURIComponent(target)}`,
        { method: "POST" },
      );
      if (response.url) {
        window.location.assign(response.url);
        return;
      }
      if (response.changed) {
        const refreshed = await dashboardRequest<MeResponse>("/api/auth/me");
        if (!refreshed.user) throw new Error("Your plan changed, but the subscription details could not be refreshed. Please reload this page.");
        setUser(refreshed.user);
        setMessage(`${refreshed.user.plan_details?.display_name || PLAN_DETAILS[refreshed.user.plan]?.label || refreshed.user.plan} is now active on your account.`);
      } else if (response.pendingPayment) {
        setMessage(response.message || "Your payment is processing. Access will update after confirmation.");
      } else {
        setMessage(response.message || "Your billing request was received.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Billing could not be reached. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const fallback = PLAN_DETAILS[user.plan] || { label: user.plan, price: "Custom", cadence: "agreement" };
  const details = user.plan_details;
  const current = details ? {
    label: details.display_name,
    price: details.display_price || formatPlanPrice(details.price_minor, details.currency),
    cadence: details.billing_label || ({ month: "per month", year: "per year", none: "" }[details.billing_interval] ?? details.billing_interval),
  } : fallback;
  const accessActive = user.access_active ?? !(user.plan === "trial" && user.trial?.expired);
  const trialExpired = user.plan === "trial" && user.trial?.expired;
  const trialProgress = user.trial
    ? Math.min(100, Math.round((user.trial.window_used / Math.max(1, user.trial.window_limit ?? 1)) * 100))
    : 0;

  return (
    <div className="subscription-page">
      <PageHeader
        description="Choose the service access that fits your workflow. Billing changes are confirmed before access updates."
        eyebrow="Plan & billing"
        title="Subscription"
      />

      {message ? <div className="inline-notice inline-notice--success"><CheckIcon /> {message}</div> : null}
      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}

      <section className="current-plan-card">
        <div className="current-plan-glow" />
        <div className="current-plan-main">
          <span className="plan-icon"><CardIcon /></span>
          <div>
            <p className="panel-kicker">Current plan</p>
            <h2>{current.label}</h2>
            <p>{user.is_comped ? "$0" : current.price} <span>{user.is_comped ? "complimentary" : current.cadence}</span></p>
          </div>
        </div>
        <div className="current-plan-status">
          <span className={!accessActive ? "status-badge status-badge--danger" : "status-badge status-badge--success"}>
            {accessActive ? "Active" : trialExpired ? "Expired" : "Access unavailable"}
          </span>
          <small>{user.plan === "trial" && user.trial ? `${user.trial.days_left} days remaining` : accessActive ? "Access is ready" : user.entitlement_status || "No active entitlement"}</small>
        </div>
        {user.plan === "trial" && user.trial ? (
          <div className="trial-meter">
            <div><span>Current UTC window</span><strong>{user.trial.window_used} / {user.trial.window_limit ?? "Unlimited"}</strong></div>
            <div className="progress-track"><span className="progress-fill progress-fill--image" style={{ width: `${trialProgress}%` }} /></div>
          </div>
        ) : null}
      </section>

      <SubscriptionDetails user={user} />

      <div className="plans-heading">
        <div><p className="panel-kicker">Available plans</p><h2>Choose your plan.</h2></div>
        <p>Access activates after payment. Applicable taxes are shown at checkout.</p>
      </div>
      <div className="plan-grid">
        {availablePlans === null ? <p>Loading plans…</p> : availablePlans.length === 0 ? <p>No public plans are available for checkout right now.</p> : availablePlans.map((plan) => (
          <article key={plan.code} className={`plan-card ${user.plan === plan.code ? "is-current" : ""}`}>
            <div className="plan-card-top"><span className="service-icon service-icon--violet"><SparklesIcon /></span></div>
            <h3>{plan.display_name}</h3>
            <p>{plan.description}</p>
            <div className="plan-price"><strong>{formatPlanPrice(plan.price_minor, plan.currency)}</strong><span>{plan.billing_interval === "none" ? "one time" : `/ ${plan.billing_interval}`}</span></div>
            <ul className="feature-list">{plan.products.map((product) => <li key={product}><CheckIcon /> {product}</li>)}</ul>
            <button className="button button-primary plan-button" type="button" disabled={user.plan === plan.code || plan.is_downgrade || loadingPlan !== null} onClick={() => void choosePlan(plan.code)}>
              {user.plan === plan.code ? "Your current plan" : plan.is_downgrade ? "Downgrade unavailable" : loadingPlan === plan.code ? "Opening checkout…" : `Choose ${plan.display_name}`}
            </button>
          </article>
        ))}
      </div>

      <section className="billing-note">
        <span className="service-icon service-icon--blue"><VoiceIcon /></span>
        <div>
          <h2>Need help with billing?</h2>
          <p>Contact support for billing changes or questions about your subscription. Payments are handled through our secure checkout provider.</p>
        </div>
        <Link className="button button-secondary" href="mailto:hello@gathos.com">Contact support</Link>
      </section>
    </div>
  );
}
