"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { WarningIcon } from "@/components/icons";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await dashboardRequest<{ ok: boolean }>(
        "/api/otp/login",
        jsonRequest({ email, password }, { method: "POST" }),
      );
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign-in could not be completed. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form aria-busy={isSubmitting} className="login-form" onSubmit={submitLogin}>
      {error ? (
        <div className="inline-notice inline-notice--danger" id="login-form-error" role="alert">
          <WarningIcon />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="login-form-field">
        <label className="field-label" htmlFor="login-email">Email address</label>
        <input
          aria-describedby={error ? "login-form-error" : undefined}
          autoCapitalize="none"
          autoComplete="email"
          disabled={isSubmitting}
          id="login-email"
          inputMode="email"
          maxLength={320}
          name="email"
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          placeholder="you@example.com"
          required
          spellCheck={false}
          type="email"
          value={email}
        />
      </div>

      <div className="login-form-field">
        <label className="field-label" htmlFor="login-password">Password</label>
        <input
          aria-describedby={error ? "login-form-error" : undefined}
          autoComplete="current-password"
          disabled={isSubmitting}
          id="login-password"
          name="password"
          maxLength={1024}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError("");
          }}
          required
          type="password"
          value={password}
        />
      </div>

      <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in with email"}
      </button>
    </form>
  );
}
