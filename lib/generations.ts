export type GenerationRecord = {
  id: string; product_code: string; product_name: string; title: string | null;
  status: string; progress: number; attempt_count: number; can_retry: boolean;
  created_at: string; started_at: string | null; completed_at: string | null;
  latest_error_code: string | null; latest_error_message: string | null;
  output_count: number; primary_asset_id: string | null; download_path: string | null;
  api_key_name: string | null;
};
export type GenerationDetail = GenerationRecord & {
  input_payload: Record<string, unknown>; source: string; accepted_at: string | null;
  attempts: Array<{ id: string; attempt_number: number; trigger_kind: string; status: string;
    progress: number; error_code: string | null; error_message: string | null; retryable: boolean;
    created_at: string; started_at: string | null; completed_at: string | null }>;
  outputs: Array<{ asset_id: string; role: string; ordinal: number; download_path: string; filename?: string | null; mime_type?: string | null; size_bytes?: number | null }>;
};
export type GenerationList = { generations: GenerationRecord[]; total: number; limit: number; offset: number };
export const GENERATION_STATUSES = ["received", "validating", "waiting_capacity", "queued", "leased", "running", "retry_wait", "submission_unknown", "cancel_requested", "lease_expired", "orphaned", "succeeded", "failed", "cancelled", "expired"];
export const isPending = (status: string) => ["received", "validating", "waiting_capacity", "queued", "leased", "running", "retry_wait", "submission_unknown", "cancel_requested"].includes(status);
export const humanize = (value: string) => value.replaceAll("_", " ");
export function generationDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
export function safeDownload(path: string | null): string | undefined {
  return path && /^\/api\/assets\/[0-9a-f-]{36}\/download$/i.test(path) ? path : undefined;
}
