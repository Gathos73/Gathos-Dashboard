"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { CheckIcon, WarningIcon } from "@/components/icons";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";

type AuthMode = "signin" | "register";
type RegisterStep = "details" | "verify" | "password";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function LoginForm() {
  const router = useRouter();
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setRegisterStep("details");
    setPassword("");
    setOtp(["", "", "", "", "", ""]);
    setError("");
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await dashboardRequest<{ ok: boolean }>(
        "/api/otp/login",
        jsonRequest({ email: email.trim(), password }, { method: "POST" }),
      );
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, "Sign-in could not be completed. Please try again."));
      setIsSubmitting(false);
    }
  }

  async function sendVerificationCode() {
    setError("");
    setIsSubmitting(true);
    try {
      await dashboardRequest<{ ok: boolean }>(
        "/api/otp/send",
        jsonRequest({ email: email.trim(), name: name.trim(), purpose: "verify" }, { method: "POST" }),
      );
      setOtp(["", "", "", "", "", ""]);
      setRegisterStep("verify");
      setResendSeconds(60);
      window.setTimeout(() => otpInputs.current[0]?.focus(), 0);
    } catch (requestError) {
      setError(errorMessage(requestError, "We could not send the verification code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Enter your name and email address.");
      return;
    }
    await sendVerificationCode();
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter the complete six-digit code.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await dashboardRequest<{ ok: boolean }>(
        "/api/otp/verify",
        jsonRequest({ email: email.trim(), code, purpose: "verify" }, { method: "POST" }),
      );
      setRegisterStep("password");
    } catch (requestError) {
      setError(errorMessage(requestError, "The code could not be verified. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least eight characters.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await dashboardRequest<{ ok: boolean }>(
        "/api/otp/register",
        jsonRequest({ email: email.trim(), name: name.trim(), password }, { method: "POST" }),
      );
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, "Your account could not be created. Please try again."));
      setIsSubmitting(false);
    }
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) otpInputs.current[index + 1]?.focus();
    if (error) setError("");
  }

  function pasteOtp(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;
    setOtp(Array.from({ length: 6 }, (_, index) => digits[index] ?? ""));
    otpInputs.current[Math.min(digits.length, 6) - 1]?.focus();
    setError("");
  }

  const describedBy = error ? "login-form-error" : undefined;

  return (
    <div className="login-auth-flow">
      {registerStep === "details" ? (
        <div className="login-mode-tabs" aria-label="Authentication method" role="tablist">
          <button aria-selected={mode === "signin"} className={mode === "signin" ? "is-active" : ""} onClick={() => selectMode("signin")} role="tab" type="button">Sign in</button>
          <button aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => selectMode("register")} role="tab" type="button">Create account</button>
        </div>
      ) : null}

      {error ? <div className="inline-notice inline-notice--danger" id="login-form-error" role="alert"><WarningIcon /><span>{error}</span></div> : null}

      {mode === "signin" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitLogin}>
          <div className="login-form-field">
            <label className="field-label" htmlFor="login-email">Email address</label>
            <input aria-describedby={describedBy} autoCapitalize="none" autoComplete="email" disabled={isSubmitting} id="login-email" inputMode="email" maxLength={320} name="email" onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="you@example.com" required spellCheck={false} type="email" value={email} />
          </div>
          <div className="login-form-field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <input aria-describedby={describedBy} autoComplete="current-password" disabled={isSubmitting} id="login-password" maxLength={1024} name="password" onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }} required type="password" value={password} />
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in with email"}</button>
        </form>
      ) : null}

      {mode === "register" && registerStep === "details" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitDetails}>
          <div className="login-form-field">
            <label className="field-label" htmlFor="register-name">Your name</label>
            <input aria-describedby={describedBy} autoComplete="name" disabled={isSubmitting} id="register-name" maxLength={200} name="name" onChange={(event) => { setName(event.target.value); if (error) setError(""); }} placeholder="Jane Smith" required type="text" value={name} />
          </div>
          <div className="login-form-field">
            <label className="field-label" htmlFor="register-email">Email address</label>
            <input aria-describedby={describedBy} autoCapitalize="none" autoComplete="email" disabled={isSubmitting} id="register-email" inputMode="email" maxLength={320} name="email" onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="you@example.com" required spellCheck={false} type="email" value={email} />
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending code…" : "Verify email"}</button>
        </form>
      ) : null}

      {mode === "register" && registerStep === "verify" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitVerification}>
          <div className="login-step-heading"><strong>Verify your email</strong><span>Enter the six-digit code sent to {email}.</span></div>
          <div className="login-otp" onPaste={(event) => { event.preventDefault(); pasteOtp(event.clipboardData.getData("text")); }}>
            {otp.map((digit, index) => (
              <input aria-label={`Verification code digit ${index + 1}`} disabled={isSubmitting} inputMode="numeric" key={index} maxLength={1} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index > 0) otpInputs.current[index - 1]?.focus(); }} ref={(element) => { otpInputs.current[index] = element; }} type="text" value={digit} />
            ))}
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting || otp.join("").length !== 6} type="submit">{isSubmitting ? "Verifying…" : "Verify code"}</button>
          <div className="login-step-actions">
            <button disabled={isSubmitting || resendSeconds > 0} onClick={() => void sendVerificationCode()} type="button">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button>
            <button disabled={isSubmitting} onClick={() => { setRegisterStep("details"); setOtp(["", "", "", "", "", ""]); setError(""); }} type="button">Change email</button>
          </div>
        </form>
      ) : null}

      {mode === "register" && registerStep === "password" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitPassword}>
          <div className="login-step-heading login-step-heading--verified"><CheckIcon /><div><strong>Email verified</strong><span>Create a password with at least eight characters.</span></div></div>
          <div className="login-form-field">
            <label className="field-label" htmlFor="register-password">Password</label>
            <input aria-describedby={describedBy} autoComplete="new-password" autoFocus disabled={isSubmitting} id="register-password" maxLength={1024} minLength={8} name="password" onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }} placeholder="At least 8 characters" required type="password" value={password} />
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account…" : "Create account"}</button>
        </form>
      ) : null}
    </div>
  );
}
