export type Plan = "free" | "trial" | "pro" | "pro_plus" | "starter" | "scale";

export type TrialUsage = {
  daily_limit: number;
  daily_used: number;
  days_left: number;
  expired: boolean;
  expires_at: string;
  generations_limit: number;
  generations_used: number;
  hours_left: number;
};

export type DashboardUser = {
  avatar?: string | null;
  effective_tier?: string | null;
  email: string;
  is_comped?: boolean;
  name: string;
  plan: Plan;
  tier_override?: string | null;
  trial?: TrialUsage | null;
  userId: string;
};

export type ApiKeyType = "image_gen" | "tts" | "video";

export type ApiKeyRecord = {
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

export type UsagePoint = {
  date: string;
  image: number;
  total: number;
  tts: number;
  video: number;
};

export type UsageService = {
  count: number;
  percentage: number;
  type: "image" | "tts" | "video";
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
  type: "image" | "tts" | "video";
};

export type UsagePayload = {
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
  by_type: { image: number; tts: number; video: number };
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
  period: { days: number; end: string; start: string; timezone: "UTC" };
  recent: Array<{
    api_key: { id: string; name: string; type: ApiKeyType } | null;
    created_at: string;
    type: "image" | "tts" | "video";
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
  };
  status?: string;
  video_url?: string;
};
