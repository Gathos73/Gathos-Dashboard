"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { CardIcon, CheckIcon, SparklesIcon, VideoIcon, VoiceIcon, WarningIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import type { DashboardUser, Plan } from "@/lib/types";

type CheckoutResponse = {
  changed?: boolean;
  message?: string;
  pendingPayment?: boolean;
  url?: string;
};

type MeResponse = { user?: DashboardUser | null };

const PLAN_DETAILS = {
  free: { label: "Free", price: "$0", cadence: "forever" },
  trial: { label: "Trial", price: "$0", cadence: "for 7 days" },
  pro: { label: "Pro", price: "$18", cadence: "per month" },
  pro_plus: { label: "Creator", price: "$45", cadence: "per month" },
  starter: { label: "Starter", price: "Custom", cadence: "plan" },
  scale: { label: "Scale", price: "Custom", cadence: "plan" },
} satisfies Record<Plan, { cadence: string; label: string; price: string }>;

export function SubscriptionClient({
  initialUser,
  paymentTarget,
}: {
  initialUser: DashboardUser;
  paymentTarget: "pro" | "pro_plus" | null;
}) {
  const [user, setUser] = useState(initialUser);
  const [loadingPlan, setLoadingPlan] = useState<"pro" | "pro_plus" | null>(null);
  const initiallyConfirmed = paymentTarget === "pro_plus"
    ? initialUser.plan === "pro_plus"
    : paymentTarget === "pro"
      ? initialUser.plan === "pro" || initialUser.plan === "pro_plus"
      : false;
  const [message, setMessage] = useState(
    paymentTarget
      ? initiallyConfirmed
        ? `${PLAN_DETAILS[initialUser.plan].label} is active on your account.`
        : "Confirming your subscription with our billing provider…"
      : "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paymentTarget) return;
    const targetConfirmed = paymentTarget === "pro_plus"
      ? user.plan === "pro_plus"
      : user.plan === "pro" || user.plan === "pro_plus";
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
        const refreshedTarget = paymentTarget === "pro_plus"
          ? refreshedPlan === "pro_plus"
          : refreshedPlan === "pro" || refreshedPlan === "pro_plus";
        if (payload.user && refreshedTarget) {
          setUser(payload.user);
          setMessage(`${PLAN_DETAILS[payload.user.plan].label} is now active on your account.`);
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

  async function choosePlan(target: "pro" | "pro_plus") {
    setLoadingPlan(target);
    setError("");
    setMessage("");
    try {
      const isCreatorUpgrade = target === "pro_plus" && user.plan === "pro";
      const response = await dashboardRequest<CheckoutResponse>(
        isCreatorUpgrade ? "/api/auth/subscribe/upgrade-creator" : `/api/auth/subscribe?plan=${target}`,
        { method: "POST" },
      );
      if (response.url) {
        window.location.assign(response.url);
        return;
      }
      if (response.changed) {
        const updatedPlan = target;
        setUser((current) => ({ ...current, plan: updatedPlan }));
        setMessage(`${PLAN_DETAILS[updatedPlan].label} is now active on your account.`);
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

  const current = PLAN_DETAILS[user.plan] || PLAN_DETAILS.free;
  const trialExpired = user.plan === "trial" && user.trial?.expired;
  const trialProgress = user.trial
    ? Math.min(100, Math.round((user.trial.generations_used / Math.max(1, user.trial.generations_limit)) * 100))
    : 0;

  return (
    <div>
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
            <p>{current.price} <span>{current.cadence}</span></p>
          </div>
        </div>
        <div className="current-plan-status">
          <span className={trialExpired ? "status-badge status-badge--danger" : "status-badge status-badge--success"}>
            {trialExpired ? "Expired" : "Active"}
          </span>
          <small>{user.plan === "trial" && user.trial ? `${user.trial.days_left} days remaining` : "Access is ready"}</small>
        </div>
        {user.plan === "trial" && user.trial ? (
          <div className="trial-meter">
            <div><span>Trial generations</span><strong>{user.trial.generations_used} / {user.trial.generations_limit}</strong></div>
            <div className="progress-track"><span className="progress-fill progress-fill--image" style={{ width: `${trialProgress}%` }} /></div>
          </div>
        ) : null}
      </section>

      <div className="plans-heading">
        <div><p className="panel-kicker">Available plans</p><h2>Build without metering every idea.</h2></div>
        <p>Both paid plans include unlimited image and TTS requests, multiple keys, analytics, and the playground.</p>
      </div>

      <div className="plan-grid">
        <article className={`plan-card ${user.plan === "pro" ? "is-current" : ""}`}>
          <div className="plan-card-top">
            <span className="service-icon service-icon--violet"><SparklesIcon /></span>
            {user.plan === "pro" ? <span className="status-badge status-badge--success">Current</span> : null}
          </div>
          <p className="plan-audience">For products using image and voice</p>
          <h3>Pro</h3>
          <div className="plan-price"><strong>$18</strong><span>/ month</span></div>
          <ul className="feature-list">
            <li><CheckIcon /> Unlimited image generation</li>
            <li><CheckIcon /> Unlimited text to speech</li>
            <li><CheckIcon /> Custom voice samples</li>
            <li><CheckIcon /> Multiple API keys</li>
            <li><CheckIcon /> Usage analytics and playground</li>
          </ul>
          <button
            className="button button-secondary plan-button"
            disabled={user.plan === "pro" || user.plan === "pro_plus" || loadingPlan !== null}
            onClick={() => choosePlan("pro")}
            type="button"
          >
            {user.plan === "pro" ? "Your current plan" : user.plan === "pro_plus" ? "Included in Creator" : loadingPlan === "pro" ? "Opening checkout…" : "Choose Pro"}
          </button>
        </article>

        <article className={`plan-card plan-card--featured ${user.plan === "pro_plus" ? "is-current" : ""}`}>
          <div className="featured-ribbon">Full creative API</div>
          <div className="plan-card-top">
            <span className="service-icon service-icon--green"><VideoIcon /></span>
            {user.plan === "pro_plus" ? <span className="status-badge status-badge--success">Current</span> : <span className="status-badge status-badge--violet">Popular</span>}
          </div>
          <p className="plan-audience">For end-to-end creator workflows</p>
          <h3>Creator</h3>
          <div className="plan-price"><strong>$45</strong><span>/ month</span></div>
          <ul className="feature-list">
            <li><CheckIcon /> Everything in Pro</li>
            <li><CheckIcon /> Text-to-video generation</li>
            <li><CheckIcon /> Generated video audio</li>
            <li><CheckIcon /> Image and audio conditioned modes</li>
            <li><CheckIcon /> Creator video API keys</li>
          </ul>
          <button
            className="button button-primary plan-button"
            disabled={user.plan === "pro_plus" || loadingPlan !== null}
            onClick={() => choosePlan("pro_plus")}
            type="button"
          >
            {user.plan === "pro_plus" ? "Your current plan" : loadingPlan === "pro_plus" ? "Checking billing…" : user.plan === "pro" ? "Upgrade for $27" : "Choose Creator"}
          </button>
        </article>
      </div>

      <section className="billing-note">
        <span className="service-icon service-icon--blue"><VoiceIcon /></span>
        <div>
          <h2>Need help with billing?</h2>
          <p>We do not expose payment details or subscription administration in this dashboard. Billing changes continue through our secure checkout provider.</p>
        </div>
        <Link className="button button-secondary" href="mailto:hello@gathos.com">Contact support</Link>
      </section>
    </div>
  );
}
