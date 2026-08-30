"use client";

import { useState } from "react";
import Link from "next/link";

import { BookIcon, CardIcon, CheckIcon, KeyIcon, LogoutIcon, UserIcon, WarningIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import type { DashboardUser, Plan } from "@/lib/types";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "G";
}

function planLabel(plan: Plan): string {
  if (plan === "pro_plus") return "Creator";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function ProfileCard({ demo, user }: { demo: boolean; user: DashboardUser }) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      if (demo) {
        setMessage("Demo mode keeps its local preview session active.");
        setSigningOut(false);
        return;
      }
      await dashboardRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      window.location.replace("/login?logged_out=1");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "You could not be signed out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div>
      <PageHeader
        description="Review the account connected to this workspace and manage your session."
        eyebrow="Account"
        title="Profile"
      />

      {message ? <div className="inline-notice inline-notice--success"><CheckIcon /> {message}</div> : null}
      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}

      <div className="profile-layout">
        <section className="panel profile-identity-card">
          <div className="profile-avatar-large">{initials(user.name)}</div>
          <div className="profile-identity-copy">
            <span className="status-badge status-badge--violet">{planLabel(user.plan)} plan</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <div className="profile-readonly-note"><UserIcon /><p><strong>Your identity is managed by your sign-in provider.</strong><span>Contact support if your name or email needs to change.</span></p></div>
        </section>

        <div className="profile-details-column">
          <section className="panel account-details-card">
            <div className="panel-heading"><div><p className="panel-kicker">Account details</p><h2>Workspace identity</h2></div></div>
            <dl className="detail-list">
              <div><dt>Display name</dt><dd>{user.name}</dd></div>
              <div><dt>Email address</dt><dd>{user.email}</dd></div>
              <div><dt>Current plan</dt><dd><span className="status-badge status-badge--success">{planLabel(user.plan)}</span></dd></div>
              <div><dt>Authentication</dt><dd>Secure session</dd></div>
            </dl>
          </section>

          <section className="panel profile-shortcuts">
            <div className="panel-heading"><div><p className="panel-kicker">Shortcuts</p><h2>Workspace settings</h2></div></div>
            <Link href="/api-keys"><span className="service-icon service-icon--violet"><KeyIcon /></span><span><strong>API keys</strong><small>Create or revoke your credentials</small></span></Link>
            <Link href="/subscription"><span className="service-icon service-icon--green"><CardIcon /></span><span><strong>Subscription</strong><small>Review plans and billing access</small></span></Link>
            <Link href="/resources"><span className="service-icon service-icon--blue"><BookIcon /></span><span><strong>Documentation</strong><small>Integration guides and agent skills</small></span></Link>
          </section>
        </div>
      </div>

      <section className="panel session-card">
        <div><span className="session-icon"><LogoutIcon /></span><div><h2>Sign out of this browser</h2><p>This clears the HTTP-only dashboard session. Your keys, voices, and subscription stay intact.</p></div></div>
        <button className="button button-danger" disabled={signingOut} onClick={signOut} type="button">{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>
    </div>
  );
}
