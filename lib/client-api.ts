import { cachedRequest, clearRequestCache } from "./request-cache";

export class DashboardApiError extends Error {
  retryAfterSeconds?: number;
  status: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "DashboardApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function dashboardRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const live = url === "/api/auth/me" || url.startsWith("/api/playground/jobs/") || url.endsWith("/url");
  if (method === "GET" && !live && options.cache !== "no-store" && typeof window !== "undefined") {
    return cachedRequest(url, () => uncachedRequest<T>(url, { ...options, signal: undefined }), options.signal, options.cache === "reload");
  }
  if (method !== "GET") clearRequestCache();
  try { return await uncachedRequest<T>(url, options); }
  finally { if (method !== "GET") clearRequestCache(); }
}

async function uncachedRequest<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
  });
  const text = await response.text();
  let payload: unknown = {};
  const isHtml = response.headers.get("content-type")?.toLowerCase().includes("text/html")
    || /^\s*(?:<!doctype\s+html|<html\b)/i.test(text);
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = isHtml ? {} : { message: text };
    }
  }
  if (response.status === 401 || response.status === 403) clearRequestCache();
  if (!response.ok) {
    const body = (payload && typeof payload === "object" ? payload : {}) as {
      detail?: string | { message?: string };
      error?: string;
      message?: string;
      retry_after_seconds?: number;
    };
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    const retryAfter = body.retry_after_seconds || Number(response.headers.get("retry-after")) || undefined;
    const submitting = (options.method ?? "GET").toUpperCase() === "POST"
      && url.startsWith("/api/playground/");
    const gatewayMessage = response.status >= 500
      ? `The server could not complete the request (HTTP ${response.status}).${submitting ? " Your request may have been received. Check Generations before submitting again." : " Please try again shortly."}`
      : `Request failed with status ${response.status}`;
    throw new DashboardApiError(
      body.message || detail || body.error || gatewayMessage,
      response.status,
      retryAfter,
    );
  }
  return payload as T;
}

export function jsonRequest(body: unknown, options: RequestInit = {}): RequestInit {
  return {
    ...options,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };
}
