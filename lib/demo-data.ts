import type {
  ApiKeyRecord,
  DashboardUser,
  UsageActivity,
  UsagePayload,
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
  tier_override: null,
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

export function createDemoUsage(days: number): UsagePayload {
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const series: UsagePoint[] = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(ANCHOR);
    date.setUTCDate(date.getUTCDate() - (safeDays - index - 1));
    const image = seededCount(index, 2);
    const tts = Math.round(seededCount(index, 7) * 0.48);
    const video = index % 4 === 0 ? Math.max(1, Math.round(seededCount(index, 11) * 0.11)) : 0;
    return {
      date: date.toISOString().slice(0, 10),
      image,
      total: image + tts + video,
      tts,
      video,
    };
  });
  const imageTotal = series.reduce((sum, point) => sum + point.image, 0);
  const ttsTotal = series.reduce((sum, point) => sum + point.tts, 0);
  const videoTotal = series.reduce((sum, point) => sum + point.video, 0);
  const total = imageTotal + ttsTotal + videoTotal;
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
      key_name: "Production images",
      type: "image",
    },
  ];

  return {
    active_keys: 3,
    average_per_day: Number((total / safeDays).toFixed(1)),
    days: safeDays,
    period_end: ANCHOR.toISOString(),
    period_start: `${series[0]?.date}T00:00:00Z`,
    recent_activity: activity,
    series,
    services: [
      { count: imageTotal, percentage: Math.round((imageTotal / total) * 100), type: "image" },
      { count: ttsTotal, percentage: Math.round((ttsTotal / total) * 100), type: "tts" },
      { count: videoTotal, percentage: Math.round((videoTotal / total) * 100), type: "video" },
    ],
    top_keys: DEMO_KEYS.map((key) => ({
      count: Math.round((key.generations_count / 1952) * total),
      id: key.id,
      name: key.name,
      type: key.type,
    })),
    total_requests: total,
    truncated: false,
  };
}
