"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  CheckIcon,
  ImageIcon,
  KeyIcon,
  PlaygroundIcon,
  SparklesIcon,
  VideoIcon,
  VoiceIcon,
  WarningIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";
import { DEMO_KEYS } from "@/lib/demo-data";
import type { ApiKeyRecord, ApiKeyType, DashboardUser, PlaygroundJob } from "@/lib/types";

type Service = "image" | "tts" | "video";
type RunState = "idle" | "submitting" | "queued" | "completed" | "failed";
type CatalogOption = { label: string; value: string };

const SERVICE_META: Record<Service, {
  endpoint: string;
  icon: typeof ImageIcon;
  keyType: ApiKeyType;
  label: string;
  pollService: string;
}> = {
  image: { endpoint: "/api/playground/image", icon: ImageIcon, keyType: "image_gen", label: "Image", pollService: "image-generation" },
  tts: { endpoint: "/api/playground/tts", icon: VoiceIcon, keyType: "tts", label: "Text to speech", pollService: "tts" },
  video: { endpoint: "/api/playground/video", icon: VideoIcon, keyType: "video", label: "Video", pollService: "video-generation" },
};

const FALLBACK_VOICE_OPTIONS: CatalogOption[] = [
  { label: "Koko", value: "koko" },
  { label: "Josh", value: "josh" },
  { label: "Pixxy", value: "pixxy" },
  { label: "Prof", value: "prof" },
  { label: "Rochie", value: "rochie" },
  { label: "Spraky", value: "spraky" },
];
const NO_STYLE_OPTION: CatalogOption = { label: "No style preset", value: "" };
const FALLBACK_VIDEO_STYLE_OPTIONS: CatalogOption[] = [
  NO_STYLE_OPTION,
  ...["Cinematic", "Clay", "Anime", "Watercolor", "Paper Cutout", "Warm 3D"].map((style) => ({ label: style, value: style })),
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function catalogItems(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "string") return [payload];
  if (!isRecord(payload)) return [];

  for (const key of keys) {
    const collection = payload[key];
    if (Array.isArray(collection)) return collection;
    if (typeof collection === "string" || isRecord(collection)) return [collection];
  }

  return [payload];
}

function uniqueOptions(options: CatalogOption[]): CatalogOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.value.toLocaleLowerCase();
    if (!option.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeVoiceOptions(payload: unknown): CatalogOption[] {
  const options = catalogItems(payload, ["preset_voices", "voices", "items"]).flatMap((item) => {
    if (typeof item === "string") {
      const value = item.trim();
      return value ? [{ label: value, value }] : [];
    }
    if (!isRecord(item)) return [];

    const value = firstString(item, ["id", "voice_id", "value", "slug", "name"]);
    if (!value) return [];
    const name = firstString(item, ["name", "label", "display_name", "displayName"]) || value;
    const gender = firstString(item, ["gender"]);
    return [{ label: gender ? `${name} · ${gender}` : name, value }];
  });

  return uniqueOptions(options);
}

function normalizeVideoStyleOptions(payload: unknown): CatalogOption[] {
  const options = catalogItems(payload, ["styles", "video_styles", "items", "loras"]).flatMap((item) => {
    if (typeof item === "string") {
      const value = item.trim();
      return value ? [{ label: value, value }] : [];
    }
    if (!isRecord(item)) return [];

    const value = firstString(item, ["value", "name", "id", "filename", "slug"]);
    if (!value) return [];
    const label = firstString(item, ["label", "display_name", "displayName", "name"]) || value;
    return [{ label, value }];
  });

  return uniqueOptions(options);
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function outputFromJob(service: Service, job: PlaygroundJob): string | null {
  if (service === "image" && job.result?.image_base64) return `data:image/png;base64,${job.result.image_base64}`;
  if (service === "tts" && job.result?.audio_base64) return `data:audio/wav;base64,${job.result.audio_base64}`;
  if (service === "video" && job.video_url) return job.video_url;
  return null;
}

function terminalStatus(status?: string): boolean {
  return ["completed", "done", "succeeded", "failed", "cancelled"].includes(status || "");
}

function stateLabel(state: RunState, job: PlaygroundJob | null): string {
  if (state === "submitting") return "Submitting request";
  if (state === "queued") {
    if (job?.status === "waiting_capacity") return "Waiting for capacity";
    if (job?.status === "processing" || job?.status === "running") return "Generating output";
    return "Request queued";
  }
  if (state === "completed") return "Generation complete";
  if (state === "failed") return "Generation failed";
  return "Ready to run";
}

export function PlaygroundClient({ demo, user }: { demo: boolean; user: DashboardUser }) {
  const [service, setService] = useState<Service>("image");
  const [keys, setKeys] = useState<ApiKeyRecord[]>(demo ? DEMO_KEYS : []);
  const [selectedKey, setSelectedKey] = useState("");
  const [prompt, setPrompt] = useState("A quiet, future-facing studio filled with warm morning light");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [ttsText, setTtsText] = useState("The tools that feel simplest often hide the most thoughtful systems.");
  const [voiceOptions, setVoiceOptions] = useState<CatalogOption[]>(FALLBACK_VOICE_OPTIONS);
  const [voice, setVoice] = useState(FALLBACK_VOICE_OPTIONS[0].value);
  const [speed, setSpeed] = useState(1);
  const [videoStyleOptions, setVideoStyleOptions] = useState<CatalogOption[]>(FALLBACK_VIDEO_STYLE_OPTIONS);
  const [videoStyle, setVideoStyle] = useState("");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [runState, setRunState] = useState<RunState>("idle");
  const [job, setJob] = useState<PlaygroundJob | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    dashboardRequest<{ keys?: ApiKeyRecord[] }>("/api/auth/keys", { signal: controller.signal })
      .then((payload) => setKeys((payload.keys || []).filter((key) => key.is_active)))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "API keys could not be loaded.");
      });
    return () => controller.abort();
  }, [demo]);

  useEffect(() => {
    if (demo || (user.plan !== "pro" && user.plan !== "pro_plus")) return;
    const controller = new AbortController();

    dashboardRequest<unknown>("/api/playground/voices", { signal: controller.signal })
      .then((payload) => {
        const options = normalizeVoiceOptions(payload);
        if (!options.length) return;
        setVoiceOptions(options);
        setVoice((current) => options.some((option) => option.value === current) ? current : options[0].value);
      })
      .catch(() => {
        // Keep the bundled presets when the live catalogue is unavailable.
      });

    if (user.plan === "pro_plus") {
      dashboardRequest<unknown>("/api/playground/video-styles", { signal: controller.signal })
        .then((payload) => {
          const liveOptions = normalizeVideoStyleOptions(payload);
          if (!liveOptions.length) return;
          const options = [NO_STYLE_OPTION, ...liveOptions];
          setVideoStyleOptions(options);
          setVideoStyle((current) => options.some((option) => option.value === current) ? current : "");
        })
        .catch(() => {
          // Keep the bundled style presets when the live catalogue is unavailable.
        });
    }

    return () => controller.abort();
  }, [demo, user.plan]);

  const serviceKeys = useMemo(
    () => keys.filter((key) => key.type === SERVICE_META[service].keyType && key.is_active),
    [keys, service],
  );
  const effectiveSelectedKey = serviceKeys.some((key) => key.id === selectedKey)
    ? selectedKey
    : serviceKeys[0]?.id || "";

  useEffect(() => () => pollController.current?.abort(), []);

  const requestPreview = useMemo(() => {
    if (service === "tts") return { text: ttsText, voice, speed };
    if (service === "video") return { prompt, mode: "t2av", style: videoStyle || undefined, generate_audio: generateAudio };
    const [width, height] = imageSize.split("x").map(Number);
    return { prompt, width, height };
  }, [generateAudio, imageSize, prompt, service, speed, ttsText, videoStyle, voice]);

  const creatorRequired = service === "video" && user.plan !== "pro_plus";
  const paidRequired = user.plan !== "pro" && user.plan !== "pro_plus";

  function changeService(nextService: Service) {
    pollController.current?.abort();
    setService(nextService);
    setSelectedKey("");
    setRunState("idle");
    setJob(null);
    setOutput(null);
    setError("");
  }

  async function pollJob(jobId: string, pollToken: string, controller: AbortController) {
    let failures = 0;
    while (!controller.signal.aborted) {
      await sleep(service === "video" ? 7000 : 3500, controller.signal);
      try {
        const update = await dashboardRequest<PlaygroundJob>(
          `/api/playground/jobs/${SERVICE_META[service].pollService}/${encodeURIComponent(jobId)}?poll_token=${encodeURIComponent(pollToken)}`,
          { signal: controller.signal },
        );
        failures = 0;
        setJob(update);
        if (!terminalStatus(update.status)) continue;
        if (["completed", "done", "succeeded"].includes(update.status || "")) {
          setOutput(outputFromJob(service, update));
          setRunState("completed");
        } else {
          setError(update.error || "The generation did not complete.");
          setRunState("failed");
        }
        return;
      } catch (pollError) {
        if (pollError instanceof Error && pollError.name === "AbortError") return;
        failures += 1;
        if (failures >= 3) {
          setError("The job server could not be reached after three attempts. The job may still be running.");
          setRunState("failed");
          return;
        }
      }
    }
  }

  async function runRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveSelectedKey || creatorRequired || paidRequired || runState === "submitting" || runState === "queued") return;
    pollController.current?.abort();
    const controller = new AbortController();
    pollController.current = controller;
    setRunState("submitting");
    setJob(null);
    setOutput(null);
    setError("");

    try {
      if (demo) {
        await sleep(850, controller.signal);
        const demoJob: PlaygroundJob = {
          estimated_completion_time: "2026-08-29T12:01:00Z",
          eta_seconds: 0,
          job_id: `demo-${service}-request`,
          progress: 100,
          status: "completed",
        };
        setJob(demoJob);
        setRunState("completed");
        return;
      }
      const accepted = await dashboardRequest<PlaygroundJob>(
        SERVICE_META[service].endpoint,
        jsonRequest({ ...requestPreview, api_key_id: effectiveSelectedKey }, { method: "POST", signal: controller.signal }),
      );
      if (!accepted.job_id) throw new Error("The service did not return a job ID.");
      if (!accepted.poll_token) throw new Error("The service did not return a secure polling token.");
      setJob(accepted);
      setRunState("queued");
      await pollJob(accepted.job_id, accepted.poll_token, controller);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "The request could not be submitted.");
      setRunState("failed");
    }
  }

  const SelectedIcon = SERVICE_META[service].icon;

  return (
    <div>
      <PageHeader
        description="Try your services with real request parameters before you wire them into an application."
        eyebrow="API workbench"
        title="Playground"
      />

      <div className="playground-security-note">
        <span><KeyIcon /></span>
        <div>
          <strong>Your secret stays secret</strong>
          <p>Select a key as the service context. The playground uses your signed-in dashboard session, so stored key secrets are never retrieved or placed in the browser.</p>
        </div>
      </div>

      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}

      <div className="playground-layout">
        <section className="panel playground-console">
          <div className="playground-tabs" role="tablist" aria-label="Playground service">
            {(Object.keys(SERVICE_META) as Service[]).map((item) => {
              const Icon = SERVICE_META[item].icon;
              return (
                <button
                  aria-selected={service === item}
                  className={service === item ? "is-active" : ""}
                  key={item}
                  onClick={() => changeService(item)}
                  role="tab"
                  type="button"
                >
                  <Icon /> {SERVICE_META[item].label}
                  {item === "video" && user.plan !== "pro_plus" ? <span>Creator</span> : null}
                </button>
              );
            })}
          </div>

          <form className="playground-form" onSubmit={runRequest}>
            <div className="playground-form-heading">
              <span className={`service-icon service-icon--${service === "tts" ? "blue" : service === "video" ? "green" : "violet"}`}><SelectedIcon /></span>
              <div><p className="panel-kicker">Request builder</p><h2>{SERVICE_META[service].label}</h2></div>
            </div>

            <label className="field-label" htmlFor="playground-key">Key context</label>
            <select disabled={!serviceKeys.length} id="playground-key" onChange={(event) => setSelectedKey(event.target.value)} value={effectiveSelectedKey}>
              {serviceKeys.length ? serviceKeys.map((key) => <option key={key.id} value={key.id}>{key.name} · •••• {key.key_hint}</option>) : <option value="">No active {SERVICE_META[service].label.toLowerCase()} key</option>}
            </select>

            {service === "image" ? (
              <>
                <label className="field-label" htmlFor="image-prompt">Prompt</label>
                <textarea id="image-prompt" maxLength={2000} onChange={(event) => setPrompt(event.target.value)} rows={5} value={prompt} />
                <label className="field-label" htmlFor="image-size">Canvas</label>
                <select id="image-size" onChange={(event) => setImageSize(event.target.value)} value={imageSize}>
                  <option value="1024x1024">Square · 1024 × 1024</option>
                  <option value="1344x768">Landscape · 1344 × 768</option>
                  <option value="768x1344">Portrait · 768 × 1344</option>
                </select>
              </>
            ) : null}

            {service === "tts" ? (
              <>
                <label className="field-label" htmlFor="tts-text">Text</label>
                <textarea id="tts-text" maxLength={10000} onChange={(event) => setTtsText(event.target.value)} rows={5} value={ttsText} />
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="tts-voice">Voice</label><select id="tts-voice" onChange={(event) => setVoice(event.target.value)} value={voice}>{voiceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                  <div><label className="field-label" htmlFor="tts-speed">Speed · {speed.toFixed(1)}×</label><input id="tts-speed" max="1.5" min="0.7" onChange={(event) => setSpeed(Number(event.target.value))} step="0.1" type="range" value={speed} /></div>
                </div>
              </>
            ) : null}

            {service === "video" ? (
              <>
                <label className="field-label" htmlFor="video-prompt">Scene prompt</label>
                <textarea id="video-prompt" maxLength={2000} onChange={(event) => setPrompt(event.target.value)} rows={5} value={prompt} />
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="video-style">Style</label><select id="video-style" onChange={(event) => setVideoStyle(event.target.value)} value={videoStyle}>{videoStyleOptions.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></div>
                  <label className="checkbox-card"><input checked={generateAudio} onChange={(event) => setGenerateAudio(event.target.checked)} type="checkbox" /><span><strong>Generate audio</strong><small>Return a video with model-generated sound.</small></span></label>
                </div>
              </>
            ) : null}

            {!serviceKeys.length ? <div className="inline-notice inline-notice--warning"><WarningIcon /> Create an active {SERVICE_META[service].label.toLowerCase()} key first. <Link href="/api-keys">Open API keys</Link></div> : null}
            {paidRequired ? <div className="inline-notice inline-notice--warning"><WarningIcon /> The playground requires Pro or Creator access. <Link href="/subscription">View plans</Link></div> : null}
            {creatorRequired ? <div className="inline-notice inline-notice--warning"><WarningIcon /> Video generation is available on the Creator plan. <Link href="/subscription">Upgrade</Link></div> : null}

            <button className="button button-primary run-button" disabled={!effectiveSelectedKey || paidRequired || creatorRequired || runState === "submitting" || runState === "queued"} type="submit">
              <SparklesIcon /> {runState === "submitting" || runState === "queued" ? "Running request…" : `Run ${SERVICE_META[service].label.toLowerCase()}`}
            </button>
          </form>
        </section>

        <aside className="playground-side">
          <section className="panel request-preview">
            <div className="panel-heading"><div><p className="panel-kicker">Request</p><h2>Payload preview</h2></div><span className="method-badge">POST</span></div>
            <code className="endpoint-line">{SERVICE_META[service].endpoint}</code>
            <pre><code>{JSON.stringify(requestPreview, null, 2)}</code></pre>
          </section>

          <section className={`panel run-output run-output--${runState}`} aria-live="polite">
            <div className="run-status-heading">
              <span className="run-status-icon">{runState === "completed" ? <CheckIcon /> : runState === "failed" ? <WarningIcon /> : <PlaygroundIcon />}</span>
              <div><p className="panel-kicker">Response</p><h2>{stateLabel(runState, job)}</h2></div>
            </div>
            {(runState === "submitting" || runState === "queued") ? (
              <div className="job-progress">
                <div><span>{job?.status || "Submitting"}</span><strong>{job?.progress ?? 8}%</strong></div>
                <div className="progress-track"><span className="progress-fill progress-fill--image is-indeterminate" style={{ width: `${Math.max(8, job?.progress ?? 8)}%` }} /></div>
                {job?.eta_seconds ? <small>About {Math.ceil(job.eta_seconds)} seconds remaining</small> : <small>We will update this panel when the job finishes.</small>}
              </div>
            ) : null}
            {runState === "idle" ? <div className="output-placeholder"><span><SparklesIcon /></span><p>Configure a request and run it. Results, progress, and errors appear here.</p></div> : null}
            {runState === "completed" && demo ? <div className="demo-output"><span>Demo response</span><strong>Request accepted and completed</strong><p>Connect the FastAPI backend to render generated media here.</p><code>{job?.job_id}</code></div> : null}
            {runState === "completed" && output && service === "image" ? <Image alt="Generated playground result" className="playground-image-result" height={1024} src={output} unoptimized width={1024} /> : null}
            {runState === "completed" && output && service === "tts" ? <audio className="playground-audio-result" controls src={output} /> : null}
            {runState === "completed" && output && service === "video" ? <video className="playground-video-result" controls src={output} /> : null}
            {runState === "completed" && !output && !demo ? <div className="demo-output"><strong>Job completed</strong><p>The service completed without a previewable output URL.</p></div> : null}
            {runState === "failed" ? <div className="output-error"><WarningIcon /><p>{error || job?.error || "This request failed."}</p></div> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
