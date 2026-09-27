"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const CODE_PATTERN = /^[A-Z0-9_-]{2,80}$/i;

export function ReferralAttribution() {
  const searchParams = useSearchParams();
  const referral = searchParams.get("ref")?.trim();

  useEffect(() => {
    if (!referral || !CODE_PATTERN.test(referral)) return;
    void fetch("/api/referral", {
      body: JSON.stringify({ code: referral }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  }, [referral]);

  return null;
}
