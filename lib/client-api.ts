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
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
  });
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    const body = payload as {
      detail?: string | { message?: string };
      error?: string;
      message?: string;
      retry_after_seconds?: number;
    };
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    const retryAfter = body.retry_after_seconds || Number(response.headers.get("retry-after")) || undefined;
    throw new DashboardApiError(
      body.message || detail || body.error || `Request failed with status ${response.status}`,
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
