import type {
  ApiKeyRecord,
  DashboardUser,
  UsageActivity,
  UsagePayload,
  UsageRange,
  UsagePoint,
  VoiceSample,
} from "@/lib/types";

export const DEMO_USER: DashboardUser = {
  avatar: null,
  effective_tier: "pro",
  email: "maya@gathos.studio",
  is_comped: false,
  name: "Maya Chen",
  plan: "pro",
  is_superuser: false,
  trial: null,
  userId: "demo-user",
};

export const DEMO_KEYS: ApiKeyRecord[] = [
  {
    calls_count: 1842,
    created_at: "2026-07-08T09:24:00Z",
    generations_count: 1287,
    id: "demo-image-key",
    is_active: true,
    key_hint: "9Qf2",
    last_used_at: "2026-08-29T09:41:00Z",
    name: "Production images",
    type: "image_gen",
  },
  {
    calls_count: 706,
    created_at: "2026-07-12T14:10:00Z",
    generations_count: 614,
    id: "demo-tts-key",
    is_active: true,
    key_hint: "hK8p",
    last_used_at: "2026-08-29T08:12:00Z",
    name: "Narration pipeline",
    type: "tts",
  },
  {
    calls_count: 63,
    created_at: "2026-08-02T11:05:00Z",
    generations_count: 51,
    id: "demo-video-key",
    is_active: true,
    key_hint: "L3wx",
    last_used_at: "2026-08-28T17:54:00Z",
    name: "Creator previews",
    type: "video",
    videos_count: 51,
  },
];

DEMO_KEYS.push({ ...DEMO_KEYS[0], id: "demo-image2image-key", name: "Image edits", type: "image2image", key_hint: "i2i1" });

export const DEMO_VOICES: VoiceSample[] = [
  {
    content_type: "audio/wav",
    created_at: "2026-08-21T10:14:00Z",
    file_size: 1483256,
    id: "demo-voice-1",
    language: "en",
    name: "maya-warm",
    ref_text: "The best tools disappear into the work you are already doing.",
  },
  {
    content_type: "audio/mpeg",
    created_at: "2026-08-15T08:31:00Z",
    file_size: 892145,
    id: "demo-voice-2",
    language: "en",
    name: "studio-narrator",
    ref_text: "Welcome back. Let us turn your next idea into something people remember.",
  },
];

const ANCHOR = new Date("2026-08-29T12:00:00Z");

function seededCount(index: number, salt: number): number {
  const wave = Math.sin((index + salt) * 0.81) * 7;
  return Math.max(0, Math.round(16 + wave + ((index * (salt + 3)) % 9)));
}

export function createDemoUsage(range: UsageRange, windowSeconds: number): UsagePayload {
  const end = new Date(ANCHOR);
  const start = new Date(end);
  const bucketMinutes = range === "current_window" ? 10 : range === "24h" ? 60 : 360;
  const hours = range === "current_window" ? windowSeconds / 3600 : range === "24h" ? 24 : 168;
  if (range === "current_window") {
    const midnight = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    start.setTime(midnight + Math.floor((start.getTime() - midnight) / (windowSeconds * 1000)) * windowSeconds * 1000);
    end.setTime(start.getTime() + hours * 3600000);
  } else start.setTime(end.getTime() - hours * 3600000);
  const safeDays = hours / 24;
  const series: UsagePoint[] = Array.from({ length: hours * 60 / bucketMinutes }, (_, index) => {
    const date = new Date(start.getTime() + index * bucketMinutes * 60000);
    const image = seededCount(index, 2);
    const image2image = Math.round(seededCount(index, 5) * 0.3);
    const tts = Math.round(seededCount(index, 7) * 0.48);
    const video = index % 4 === 0 ? Math.max(1, Math.round(seededCount(index, 11) * 0.11)) : 0;
    return {
      date: date.toISOString(),
      image,
      image2image,
      total: image + image2image + tts + video,
      tts,
      video,
    };
  });
  const imageTotal = series.reduce((sum, point) => sum + point.image, 0);
  const ttsTotal = series.reduce((sum, point) => sum + point.tts, 0);
  const videoTotal = series.reduce((sum, point) => sum + point.video, 0);
  const image2imageTotal = series.reduce((sum, point) => sum + point.image2image, 0);
  const total = imageTotal + image2imageTotal + ttsTotal + videoTotal;
  const activity: UsageActivity[] = [
    {
      created_at: "2026-08-29T09:41:00Z",
      id: "activity-1",
      key_name: "Production images",
      type: "image",
    },
    {
      created_at: "2026-08-29T08:12:00Z",
      id: "activity-2",
      key_name: "Narration pipeline",
      type: "tts",
    },
    {
      created_at: "2026-08-28T17:54:00Z",
      id: "activity-3",
      key_name: "Creator previews",
      type: "video",
    },
    {
      created_at: "2026-08-28T15:26:00Z",
      id: "activity-4",
      key_name: "Image edits",
      type: "image2image",
    },
  ];

  return {
    limits: { access_active: true, items: [
      { id: "demo-plan", label: "All services", kind: "requests", limit: 1000, used: 120, remaining: 880, window_seconds: windowSeconds, resets_at: end.toISOString() },
      { id: "demo-concurrency", label: "All services", kind: "concurrency", limit: 4, used: 1, remaining: 3, window_seconds: null, resets_at: null },
    ] },
    active_keys: DEMO_KEYS.filter((key) => key.is_active).length,
    average_per_day: Number((total / safeDays).toFixed(1)),
    days: safeDays,
    bucket_minutes: bucketMinutes,
    sampled_at: end.toISOString(),
    period_end: end.toISOString(),
    period_start: start.toISOString(),
    recent_activity: activity.map((item, index) => ({ ...item, created_at: new Date(end.getTime() - (index + 1) * bucketMinutes * 60000).toISOString() })),
    series,
    services: [
      { count: image2imageTotal, percentage: Math.round((image2imageTotal / total) * 100), type: "image2image" },
      { count: imageTotal, percentage: Math.round((imageTotal / total) * 100), type: "image" },
      { count: ttsTotal, percentage: Math.round((ttsTotal / total) * 100), type: "tts" },
      { count: videoTotal, percentage: Math.round((videoTotal / total) * 100), type: "video" },
    ],
    top_keys: DEMO_KEYS.map((key) => ({
      count: key.type === "image2image" ? image2imageTotal : key.type === "image_gen" ? imageTotal : key.type === "tts" ? ttsTotal : videoTotal,
      id: key.id,
      name: key.name,
      type: key.type,
    })),
    total_requests: total,
    truncated: false,
  };
}
