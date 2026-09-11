import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftIcon, AnalyticsIcon, CheckIcon, KeyIcon, SparklesIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/server-user";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = { searchParams: Promise<{ error?: string; logged_out?: string }> };

const AUTH_ERRORS: Record<string, string> = {
  auth_failed: "Sign-in could not be completed. Please try again.",
  db_error: "Your account could not be loaded. Please try again in a moment.",
  disposable_email: "Please use a permanent email address for your Gathos account.",
  no_code: "The sign-in response was incomplete. Please start again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [user, parameters] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/");
  const error = parameters.error ? AUTH_ERRORS[parameters.error] || "Sign-in could not be completed." : "";

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand"><span aria-hidden="true" className="brand-mark">G</span><strong className="brand-wordmark">Gathos</strong></div>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your dashboard</h1>
          <p className="login-description">Continue with the account you use for Gathos. Your session is stored in a secure HTTP-only cookie.</p>
          {parameters.logged_out === "1" ? <div className="inline-notice inline-notice--success"><CheckIcon /> You have been signed out.</div> : null}
          {error ? <div className="inline-notice inline-notice--danger" role="alert">{error}</div> : null}
          <LoginForm />
          <div className="login-divider"><span>or</span></div>
          <Link className="google-button" href="/api/auth/google" prefetch={false}>
            <span className="google-mark" aria-hidden="true">G</span>
            Continue with Google
          </Link>
          <div className="login-security"><span className="status-dot" /><p><strong>Protected by Gathos authentication</strong><small>Your signed-in session stays in a secure HTTP-only cookie.</small></p></div>
          <p className="login-legal">By continuing, you agree to the Gathos <a href="https://gathos.com/legal?tab=terms">Terms</a> and <a href="https://gathos.com/legal?tab=privacy">Privacy Policy</a>.</p>
        </div>
        <Link className="back-to-site" href="https://gathos.com"><ArrowLeftIcon size={14} /> Back to gathos.com</Link>
      </section>

      <aside className="login-story">
        <Link className="login-brand" href="https://gathos.com">
          <span aria-hidden="true" className="brand-mark brand-mark--large">G</span>
          <span><strong className="brand-wordmark">Gathos</strong><small>Developer dashboard</small></span>
        </Link>
        <div className="login-story-copy">
          <p className="eyebrow eyebrow--light">One creative API workspace</p>
          <h2>Build, test, and understand every request.</h2>
          <p>Manage your media APIs without exposing credentials or crossing into internal administration.</p>
        </div>
        <div className="login-feature-list">
          <div><span><AnalyticsIcon /></span><p><strong>Usage at a glance</strong><small>Service trends and key activity</small></p></div>
          <div><span><KeyIcon /></span><p><strong>Scoped credentials</strong><small>Separate keys for each workflow</small></p></div>
          <div><span><SparklesIcon /></span><p><strong>Built-in playground</strong><small>Test image, voice, and video safely</small></p></div>
        </div>
        <p className="login-story-footer">Gathos · Image, voice, and video APIs</p>
      </aside>
    </main>
  );
}
