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
  auth_not_configured: "Sign-in is temporarily unavailable. Please contact support.",
  access_denied: "Sign-in was cancelled or access was denied.",
  account_conflict: "This email is already linked to a different sign-in identity. Please contact support.",
  account_inactive: "This account is inactive. Please contact support.",
  db_error: "Your account could not be loaded. Please try again in a moment.",
  disposable_email: "Please use a permanent email address for your Gathos account.",
  invalid_state: "Your sign-in request expired or could not be verified. Please start again.",
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
          <p className="login-description">Sign in with your Gathos email and password, or continue with social login and organization SSO.</p>
          {parameters.logged_out === "1" ? <div className="inline-notice inline-notice--success"><CheckIcon /> You have been signed out.</div> : null}
          {error ? <div className="inline-notice inline-notice--danger" role="alert">{error}</div> : null}
          <LoginForm />
          <div className="login-divider"><span>or</span></div>
          <Link className="workos-button" href="/api/auth/login" prefetch={false}>
            <span className="social-provider-icons" aria-hidden="true">
              <svg className="social-provider-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
                <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3a10 10 0 0 0 0 9.1L6.4 14Z" />
                <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3 7.5l3.4 2.6A6 6 0 0 1 12 5.9Z" />
              </svg>
              <svg className="social-provider-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M17.1 12.6c0-2.8 2.3-4.2 2.4-4.3A5.2 5.2 0 0 0 15.4 6c-1.8-.2-3.4 1-4.3 1s-2.2-1-3.7-1A5.5 5.5 0 0 0 2.8 8.8c-2 3.4-.5 8.4 1.4 11.2.9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.7.9c1.5 0 2.5-1.4 3.4-2.7a12.2 12.2 0 0 0 1.6-3.3 4.9 4.9 0 0 1-2.9-4.2ZM14.2 4.1A4.9 4.9 0 0 0 15.3.5a5 5 0 0 0-3.3 1.7 4.7 4.7 0 0 0-1.2 3.5 4.1 4.1 0 0 0 3.4-1.6Z" />
              </svg>
              <svg className="social-provider-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 .7A11.5 11.5 0 0 0 8.4 23c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7Z" />
              </svg>
            </span>
            Login with Social
          </Link>
          <div className="login-security"><span className="status-dot" /><p><strong>Secure Gathos authentication</strong><small>Both sign-in methods create the same secure HTTP-only session.</small></p></div>
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
