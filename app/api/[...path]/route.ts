import type { NextRequest } from "next/server";

import { getBackendUrl } from "@/lib/server-user";
import { accountCache } from "@/lib/server-account-cache";
import { resolveAssetDownload } from "@/lib/asset-download";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const CLIENT_IDENTITY_HEADERS = new Set([
  "cf-connecting-ip",
  "fastly-client-ip",
  "fly-client-ip",
  "forwarded",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const MAX_BODY_BYTES = 22 * 1024 * 1024;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{1,200}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function methodIs(method: string, ...allowed: string[]): boolean {
  return allowed.includes(method);
}

function isAllowedRoute(path: string[], method: string): boolean {
  const joined = path.join("/");

  if (joined === "generations") return methodIs(method, "GET", "HEAD");
  if (path[0] === "generations" && UUID_PATTERN.test(path[1] ?? "")) {
    if (path.length === 2) return methodIs(method, "GET", "HEAD");
    if (path.length === 3 && path[2] === "retry") return method === "POST";
  }
  if (path.length === 3 && path[0] === "assets" && UUID_PATTERN.test(path[1]) && path[2] === "download") {
    return methodIs(method, "GET", "HEAD");
  }

  if (joined === "auth/me" || joined === "auth/usage") return methodIs(method, "GET", "HEAD");
  if (joined === "auth/plans") return methodIs(method, "GET", "HEAD");
  if (joined === "auth/logout") return method === "POST";
  if (joined === "auth/google" || joined === "auth/login") return methodIs(method, "GET", "HEAD");
  if (joined === "otp/login") return method === "POST";
  if (joined === "auth/keys") return methodIs(method, "GET", "POST", "HEAD");
  if (path.length === 3 && path[0] === "auth" && path[1] === "keys") {
    return method === "DELETE" && UUID_PATTERN.test(path[2]);
  }
  if (joined === "auth/subscribe") return method === "POST";
  if (joined === "auth/subscribe/upgrade-creator") return method === "POST";
  if (joined === "priority-support") return methodIs(method, "GET", "POST", "HEAD");

  if (joined === "voices") return methodIs(method, "GET", "HEAD");
  if (joined === "voices/upload") return method === "POST";
  if (path.length === 2 && path[0] === "voices") {
    return method === "DELETE" && UUID_PATTERN.test(path[1]);
  }
  if (path.length === 3 && path[0] === "voices" && path[2] === "url") {
    return methodIs(method, "GET", "HEAD") && UUID_PATTERN.test(path[1]);
  }

  if (["playground/image", "playground/image2image", "playground/tts", "playground/video"].includes(joined)) {
    return method === "POST";
  }
  if (["playground/voices", "playground/video-styles"].includes(joined)) {
    return methodIs(method, "GET", "HEAD");
  }
  if (path.length === 4 && path[0] === "playground" && path[1] === "jobs") {
    const serviceAllowed = ["image-generation", "image2image", "tts", "video-generation"].includes(path[2]);
    return methodIs(method, "GET", "HEAD") && serviceAllowed && IDENTIFIER_PATTERN.test(path[3]);
  }

  return false;
}

function hasPermittedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return SAFE_METHODS.has(request.method);
  return origin === request.nextUrl.origin;
}

async function readRequestBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (!request.body) return undefined;
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RangeError("request body too large");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("request body too large");
    }
    chunks.push(value);
  }
  if (total === 0) return undefined;

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer as ArrayBuffer;
}

function requestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  for (const name of CLIENT_IDENTITY_HEADERS) headers.delete(name);
  headers.delete("accept-encoding");
  headers.set("x-gathos-client", "dashboard-bff");
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    const lowerName = name.toLowerCase();
    if (
      !HOP_BY_HOP_HEADERS.has(lowerName)
      && lowerName !== "set-cookie"
      && lowerName !== "content-encoding"
      && !lowerName.startsWith("access-control-")
    ) {
      headers.append(name, value);
    }
  });

  const cookieHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = cookieHeaders.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) headers.append("set-cookie", cookie);
  } else {
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) headers.append("set-cookie", cookie);
  }
  headers.set("cache-control", "private, no-store, max-age=0");
  return headers;
}

function upstreamPath(path: string[]): string {
  const encoded = path.map((segment) => encodeURIComponent(segment)).join("/");
  if (encoded === "otp/login") return "dashboard-auth/login";
  return encoded === "voices" ? `${encoded}/` : encoded;
}

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (!isAllowedRoute(path, request.method)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!hasPermittedOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }

  const upstreamUrl = new URL(`${getBackendUrl()}/api/${upstreamPath(path)}`);
  upstreamUrl.search = request.nextUrl.search;
  let rawBody: ArrayBuffer | undefined;
  try {
    rawBody = SAFE_METHODS.has(request.method) ? undefined : await readRequestBody(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return Response.json(
        { error: "request_too_large", message: "Combined uploads are limited to 22 MB." },
        { status: 413 },
      );
    }
    return Response.json({ error: "invalid_request_body" }, { status: 400 });
  }

  const token = request.cookies.get("gathos_session")?.value;
  const refreshAccount = !SAFE_METHODS.has(request.method) || path.join("/") === "auth/me";
  if (token && refreshAccount) accountCache.invalidate(token);
  const startedAt = Date.now();
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]);
    let upstream = await fetch(upstreamUrl, {
      body: rawBody,
      cache: "no-store",
      headers: requestHeaders(request),
      method: request.method,
      redirect: "manual",
      signal,
    });
    if (upstream.status >= 500) {
      console.error("[dashboard-api] upstream failure", {
        method: request.method,
        route: path.join("/"),
        status: upstream.status,
        elapsedMs: Date.now() - startedAt,
        rayId: request.headers.get("cf-ray"),
        upstreamRayId: upstream.headers.get("cf-ray"),
      });
    }
    if (token && (upstream.status === 401 || upstream.status === 403)) accountCache.invalidate(token);
    if (path[0] === "assets" && path[2] === "download" && request.method === "GET") {
      upstream = await resolveAssetDownload(upstream, signal);
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      headers: responseHeaders(upstream),
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch (error) {
    // Do not log request bodies, cookies, query strings, or raw fetch errors.
    const cause = error instanceof Error ? error.cause as { code?: unknown } | undefined : undefined;
    console.error("[dashboard-api] forwarding failure", {
      method: request.method,
      route: path.join("/"),
      elapsedMs: Date.now() - startedAt,
      rayId: request.headers.get("cf-ray"),
      errorName: error instanceof Error ? error.name : "UnknownError",
      causeCode: typeof cause?.code === "string" ? cause.code : undefined,
    });
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json(
        { error: "backend_timeout", message: "The dashboard API took too long to respond." },
        { status: 504 },
      );
    }
    return Response.json(
      { error: "backend_unavailable", message: "The dashboard API is temporarily unavailable." },
      { status: 502 },
    );
  } finally {
    // Also discard reads that raced with a mutation or a live billing refresh.
    if (token && refreshAccount) accountCache.invalidate(token);
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
export const HEAD = forward;
