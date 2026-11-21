"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, Eye, EyeOff } from "lucide-react";

import { DashboardApiError, dashboardRequest, jsonRequest } from "@/lib/client-api";

type AuthMode = "signin" | "register" | "reset";
type FlowStep = "details" | "verify" | "password" | "complete";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function PasswordField({ id, label, value, onChange, disabled, describedBy, isNew = false, autoFocus = false }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  describedBy?: string;
  isNew?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="login-form-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="login-password-input">
        <input aria-describedby={describedBy} autoComplete={isNew ? "new-password" : "current-password"} autoFocus={autoFocus} disabled={disabled} id={id} maxLength={1024} minLength={isNew ? 8 : undefined} name={id} onChange={(event) => onChange(event.target.value)} placeholder={isNew ? "At least 8 characters" : undefined} required type={visible ? "text" : "password"} value={value} />
        <button aria-controls={id} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} className="login-password-toggle" disabled={disabled} onClick={() => setVisible((current) => !current)} type="button">
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ destination = "/", purchasing = false, children }: { destination?: string; purchasing?: boolean; children?: ReactNode }) {
  const router = useRouter();
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const completionInFlight = useRef(false);
  const [mode, setMode] = useState<AuthMode>(purchasing ? "register" : "signin");
  const [step, setStep] = useState<FlowStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verificationToken, setVerificationToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const resetting = mode === "reset";
  const purpose = resetting ? "reset" : "verify";

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (step === "verify") otpInputs.current[0]?.focus();
  }, [step]);

  function clearVerification() {
    setOtp(["", "", "", "", "", ""]);
    setVerificationToken("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStep("details");
    clearVerification();
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
      router.replace(destination);
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
        jsonRequest({ email: email.trim(), name: name.trim(), purpose }, { method: "POST" }),
      );
      clearVerification();
      setStep("verify");
      setResendSeconds(60);
      otpInputs.current[0]?.focus();
    } catch (requestError) {
      setError(errorMessage(requestError, "We could not send the verification code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || (mode === "register" && !name.trim())) {
      setError(resetting ? "Enter your email address." : "Enter your name and email address.");
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
      const result = await dashboardRequest<{ ok: boolean; verification_token?: string }>(
        "/api/otp/verify",
        jsonRequest({ email: email.trim(), code, purpose }, { method: "POST" }),
      );
      if (!result.verification_token) throw new Error("Verification could not be completed. Request a new code.");
      setVerificationToken(result.verification_token);
      setStep("password");
    } catch (requestError) {
      setError(errorMessage(requestError, "The code could not be verified. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completionInFlight.current) return;
    if (password.length < 8) {
      setError("Password must be at least eight characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    completionInFlight.current = true;
    try {
      await dashboardRequest<{ ok: boolean }>(
        resetting ? "/api/otp/forgot-password" : "/api/otp/register",
        jsonRequest(resetting
          ? { email: email.trim(), newPassword: password, verification_token: verificationToken }
          : { email: email.trim(), name: name.trim(), password, verification_token: verificationToken },
        { method: "POST" }),
      );
      if (resetting) {
        clearVerification();
        setStep("complete");
        setIsSubmitting(false);
      } else {
        router.replace(destination);
        router.refresh();
      }
    } catch (requestError) {
      // A lost registration response can leave a committed account. Prove the
      // just-submitted credentials before recovering an account conflict.
      if (!resetting && requestError instanceof DashboardApiError && requestError.status === 409) {
        try {
          await dashboardRequest<{ ok: boolean }>(
            "/api/otp/login",
            jsonRequest({ email: email.trim(), password }, { method: "POST" }),
          );
          router.replace(destination);
          router.refresh();
          return;
        } catch {
          // Preserve the original error when credentials do not match.
        }
      }
      setError(errorMessage(requestError, resetting ? "Your password could not be reset. Please try again." : "Your account could not be created. Please try again."));
      setIsSubmitting(false);
    } finally {
      completionInFlight.current = false;
    }
  }

  function updateOtp(index: number, value: string) {
    if (value.replace(/\D/g, "").length > 1) {
      pasteOtp(value);
      return;
    }
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
  const title = mode === "signin" ? "Welcome back" : step === "complete" ? "Password updated" : step === "verify" ? "Check your email" : step === "password" ? (resetting ? "Set a new password" : "Set your password") : resetting ? "Forgot your password?" : purchasing ? "Continue with your selected plan" : "Create your account";
  const description = mode === "signin" ? "Sign in to your Gathos dashboard." : step === "complete" ? "Your password has been reset. Sign in with your new password." : step === "verify" ? `Enter the six-digit code sent to ${email.trim()}.` : step === "password" ? "Choose a password with at least eight characters." : resetting ? "Enter your account email and we’ll send you a verification code." : "Start with your name and email address.";

  return (
    <div className="login-auth-flow">
      <div className="login-flow-heading" aria-live="polite">
        <h1>{title}</h1>
        <p className="login-description">{description}</p>
      </div>
      {error ? <div className="inline-notice inline-notice--danger" id="login-form-error" role="alert"><CircleAlert aria-hidden="true" size={18} /><span>{error}</span></div> : null}

      {mode === "signin" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitLogin}>
          <div className="login-form-field">
            <label className="field-label" htmlFor="login-email">Email address</label>
            <input aria-describedby={describedBy} autoCapitalize="none" autoComplete="email" disabled={isSubmitting} id="login-email" inputMode="email" maxLength={320} name="email" onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" required spellCheck={false} type="email" value={email} />
          </div>
          <PasswordField describedBy={describedBy} disabled={isSubmitting} id="login-password" label="Password" onChange={(value) => { setPassword(value); setError(""); }} value={password} />
          <div className="login-forgot"><button className="login-text-button" disabled={isSubmitting} onClick={() => selectMode("reset")} type="button">Forgot password?</button></div>
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in with email"}</button>
        </form>
      ) : null}

      {mode !== "signin" && step === "details" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitDetails}>
          {mode === "register" ? <div className="login-form-field">
            <label className="field-label" htmlFor="register-name">Your name</label>
            <input aria-describedby={describedBy} autoComplete="name" autoFocus disabled={isSubmitting} id="register-name" maxLength={200} name="name" onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="Jane Smith" required type="text" value={name} />
          </div> : null}
          <div className="login-form-field">
            <label className="field-label" htmlFor={`${mode}-email`}>Email address</label>
            <input aria-describedby={describedBy} autoCapitalize="none" autoComplete="email" autoFocus={resetting} disabled={isSubmitting} id={`${mode}-email`} inputMode="email" maxLength={320} name="email" onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" required spellCheck={false} type="email" value={email} />
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending code…" : resetting ? "Send reset code" : "Verify email"}</button>
        </form>
      ) : null}

      {mode !== "signin" && step === "verify" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitVerification}>
          <div className="login-otp" onPaste={(event) => { event.preventDefault(); pasteOtp(event.clipboardData.getData("text")); }}>
            {otp.map((digit, index) => (
              <input aria-label={`Verification code digit ${index + 1}`} autoComplete={index === 0 ? "one-time-code" : "off"} disabled={isSubmitting} inputMode="numeric" key={index} maxLength={1} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index > 0) otpInputs.current[index - 1]?.focus(); }} ref={(element) => { otpInputs.current[index] = element; }} type="text" value={digit} />
            ))}
          </div>
          <button className="button button-primary login-submit" disabled={isSubmitting || otp.join("").length !== 6} type="submit">{isSubmitting ? "Verifying…" : "Verify code"}</button>
          <div className="login-step-actions">
            <button disabled={isSubmitting || resendSeconds > 0} onClick={() => void sendVerificationCode()} type="button">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button>
            <button disabled={isSubmitting} onClick={() => { setStep("details"); clearVerification(); }} type="button">Change email</button>
          </div>
        </form>
      ) : null}

      {mode !== "signin" && step === "password" ? (
        <form aria-busy={isSubmitting} className="login-form" onSubmit={submitPassword}>
          <div className="login-step-heading login-step-heading--verified"><Check aria-hidden="true" size={19} /><strong>Email verified</strong></div>
          <PasswordField autoFocus describedBy={describedBy} disabled={isSubmitting} id={`${mode}-password`} isNew key={`${mode}-password`} label={resetting ? "New password" : "Password"} onChange={(value) => { setPassword(value); setError(""); }} value={password} />
          <PasswordField describedBy={describedBy} disabled={isSubmitting} id={`${mode}-confirm-password`} isNew key={`${mode}-confirm-password`} label="Confirm password" onChange={(value) => { setConfirmPassword(value); setError(""); }} value={confirmPassword} />
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? (resetting ? "Resetting password…" : "Creating account…") : resetting ? "Reset password" : "Create account"}</button>
        </form>
      ) : null}

      {resetting && step === "complete" ? (
        <div className="login-form">
          <div className="inline-notice inline-notice--success" role="status"><Check aria-hidden="true" size={18} /><span>You’re ready to sign in.</span></div>
          <button className="button button-primary login-submit" onClick={() => selectMode("signin")} type="button">Back to sign in</button>
        </div>
      ) : (
        <p className="login-mode-switch">
          {mode === "signin" ? <>New user? <button className="login-text-button" disabled={isSubmitting} onClick={() => selectMode("register")} type="button">Create an account</button></> : mode === "register" ? <>Already have an account? <button className="login-text-button" disabled={isSubmitting} onClick={() => selectMode("signin")} type="button">Sign in</button></> : <button className="login-text-button login-back-button" disabled={isSubmitting} onClick={() => selectMode("signin")} type="button"><ArrowLeft aria-hidden="true" size={14} />Back to sign in</button>}
        </p>
      )}
      {(mode === "signin" || (mode === "register" && step === "details")) ? children : null}
    </div>
  );
}
