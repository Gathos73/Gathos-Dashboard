import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/server-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CODE_PATTERN = /^[A-Z0-9_-]{2,80}$/i;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "invalid_referral_code" }, { status: 422 });
  }

  // First touch wins in the browser as well as in the database.
  const existing = request.cookies.get("gathos_ref")?.value;
  if (existing) return NextResponse.json({ ok: true, code: existing, captured: false });

  const clickUrl = new URL(`${getBackendUrl()}/api/affiliate/click`);
  clickUrl.searchParams.set("ref", code);
  const click = await fetch(clickUrl, { cache: "no-store", signal: AbortSignal.timeout(5_000) })
    .catch(() => null);
  if (!click?.ok) {
    return NextResponse.json({ error: "invalid_referral_code" }, { status: 422 });
  }

  const response = NextResponse.json({ ok: true, code, captured: true });
  response.cookies.set("gathos_ref", code, {
    domain: request.nextUrl.hostname.endsWith("gathos.com") ? ".gathos.com" : undefined,
    httpOnly: true,
    maxAge: THIRTY_DAYS,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
  });
  return response;
}
