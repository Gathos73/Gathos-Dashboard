"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="standalone-state">
      <span className="brand-mark brand-mark--large">G</span>
      <p className="eyebrow">Something went wrong</p>
      <h1>The dashboard hit a snag.</h1>
      <p>Your account data is safe. Retry the request, or come back in a moment.</p>
      <button className="button button-primary" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
