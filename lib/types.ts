export type Plan = string;

export type TrialUsage = {
  window_limit: number | null;
  window_used: number;
  window_resets_at: string | null;
  window_seconds: number;
  days_left: number;
  expired: boolean;
  expires_at: string;
  generations_used: number;
  hours_left: number;
};

export type DashboardUser = {
  subscription?: {
    id: string;
    status: string;
    source: string;
    billing_provider: string | null;
    provider_subscription_id: string | null;
    provider_status: string | null;
    starts_at: string;
    current_period_starts_at: string | null;
    current_period_ends_at: string | null;
    ends_at: string | null;
    cancelled_at: string | null;
    display_price: string | null;
    billing_label: string;
  } | null;
  product_codes?: string[];
  access_active?: boolean;
  entitlement_status?: string | null;
  plan_details?: {
    display_name: string;
    price_minor: number;
    currency: string;
    billing_interval: string;
    display_price?: string | null;
    billing_label?: string | null;
    priority_support?: boolean;
  } | null;
  avatar?: string | null;
  effective_tier?: string | null;
  email: string;
  is_comped?: boolean;
  name: string;
  plan: Plan;
  priority_support?: boolean;
  is_superuser?: boolean;
  trial?: TrialUsage | null;
  userId: string;
};

export type PrioritySupportTicket = {
  id: string;
  user_id: string;
  api_key_id?: string | null;
  api_key_hint?: string | null;
  api_key_name?: string | null;
  product_id?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  generation_id?: string | null;
  description: string;
  greivience?: string;
  status: "open" | "resolved" | string;
  created_at: string;
  updated_at?: string;
};

export type ApiKeyType = "image_gen" | "tts" | "video" | "image2image" | "unknown";

export type ApiKeyRecord = {
  scope?: "all_entitled" | "selected_products";
  product_codes?: string[];
  calls_count: number;
  created_at: string;
  full_key?: string;
  generations_count: number;
  id: string;
  is_active: boolean;
  key_hint: string;
  last_used_at?: string | null;
  name: string;
  type: ApiKeyType;
  videos_count?: number;
};

export type UsageRange = "current_window" | "24h" | "7d";

export type UsagePoint = {
  date: string;
  image: number;
  image2image: number;
  total: number;
  tts: number;
  video: number;
};

export type UsageService = {
  count: number;
  percentage: number;
  type: "image" | "image2image" | "tts" | "video";
};

export type UsageKey = {
  count: number;
  id: string;
  name: string;
  type: ApiKeyType;
};

export type UsageActivity = {
  created_at: string;
  id: string;
  key_name?: string | null;
  type: "image" | "image2image" | "tts" | "video";
};

export type UsageLimits = {
  access_active: boolean;
  items: Array<{
    id: string;
    label: string;
    kind: "requests" | "queue" | "concurrency";
    limit: number;
    used: number;
    remaining: number;
    resets_at: string | null;
    window_seconds: number | null;
  }>;
};

export type UsagePayload = {
  limits?: UsageLimits;
  bucket_minutes?: number;
  sampled_at?: string;
  active_keys: number;
  average_per_day: number;
  days: number;
  period_end: string;
  period_start: string;
  recent_activity: UsageActivity[];
  series: UsagePoint[];
  services: UsageService[];
  top_keys: UsageKey[];
  total_requests: number;
  truncated: boolean;
};

export type UsageApiPayload = {
  limits?: UsageLimits;
  by_type: { image2image?: number; image: number; tts: number; video: number };
  daily: UsagePoint[];
  keys: Array<{
    created_at?: string | null;
    id: string;
    is_active: boolean;
    last_used_at?: string | null;
    lifetime_calls: number;
    lifetime_generations: number;
    lifetime_videos: number;
    name: string;
    requests: number;
    type: ApiKeyType | "unknown";
  }>;
  period: { days: number; end: string; start: string; timezone: "UTC"; bucket_minutes?: number; sampled_at?: string };
  recent: Array<{
    api_key: { id: string; name: string; type: ApiKeyType } | null;
    created_at: string;
    type: "image" | "image2image" | "tts" | "video";
  }>;
  summary: {
    active_keys: number;
    lifetime_calls: number;
    lifetime_generations: number;
    requests: number;
    total_keys: number;
  };
  truncated: boolean;
};

export type VoiceSample = {
  content_type?: string | null;
  created_at: string;
  file_size: number;
  id: string;
  language: string;
  name: string;
  ref_text?: string | null;
};

export type PlaygroundJob = {
  generation_id?: string;
  error?: string;
  estimated_completion_time?: string | null;
  eta_seconds?: number | null;
  job_id?: string;
  poll_token?: string;
  progress?: number;
  queue_depth?: number | null;
  queue_position?: number | null;
  result?: {
    audio_base64?: string;
    image_base64?: string;
    image_url?: string;
  };
  status?: string;
  image_url?: string;
  video_url?: string;
};
