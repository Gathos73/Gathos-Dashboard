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
import { PlaygroundDownload } from "@/components/playground-download";
import { PageHeader } from "@/components/page-header";
import { canUseProduct, keyMatchesProduct } from "@/lib/access";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";
import { DEMO_KEYS, DEMO_VOICES } from "@/lib/demo-data";
import type { ApiKeyRecord, ApiKeyType, DashboardUser, PlaygroundJob, VoiceSample } from "@/lib/types";

type Service = "image" | "image2image" | "tts" | "video";
type RunState = "idle" | "submitting" | "queued" | "completed" | "failed";
type CatalogOption = { label: string; value: string };

const SERVICE_META: Record<Service, {
  endpoint: string;
  icon: typeof ImageIcon;
  keyType: ApiKeyType;
  label: string;
  pollService: string;
}> = {
  image: { endpoint: "/api/playground/image", icon: ImageIcon, keyType: "image_gen", label: "Text to image", pollService: "image-generation" },
  image2image: { endpoint: "/api/playground/image2image", icon: ImageIcon, keyType: "image2image", label: "Image to image", pollService: "image2image" },
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
// Snapshot of aliases reported available by the video proxy on 2026-09-11.
// New 3D and Warm 3D resolve to the same model; show Warm 3D once.
const VIDEO_STYLE_OPTIONS: CatalogOption[] = [
  NO_STYLE_OPTION,
  ...["Anime", "Stylized 3D", "Warm 3D", "Cinematic", "2D Flat"].map((style) => ({ label: style, value: style })),
];
const IMAGE_PRESETS = ["1024x1024", "1344x768", "768x1344"];

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
  if ((service === "image" || service === "image2image") && job.result?.image_base64) return `data:image/png;base64,${job.result.image_base64}`;
  if (service === "image2image") return job.image_url || job.result?.image_url || null;
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

export function PlaygroundClient({ demo, user, initialKeys }: { demo: boolean; user: DashboardUser; initialKeys?: ApiKeyRecord[] }) {
  const [service, setService] = useState<Service>("image");
  const [keys, setKeys] = useState<ApiKeyRecord[]>(demo ? DEMO_KEYS : (initialKeys ?? []));
  const [selectedKey, setSelectedKey] = useState("");
  const [prompt, setPrompt] = useState("A quiet, future-facing studio filled with warm morning light");
  const [sourceImage, setSourceImage] = useState("");
  const [referenceImage, setReferenceImage] = useState("");
  const [imageWidth, setImageWidth] = useState("1024");
  const [imageHeight, setImageHeight] = useState("1024");
  const imageSize = `${imageWidth}x${imageHeight}`;
  const dimensionLimits = service === "image2image" ? { min: 32, max: 4096, step: 1 } : { min: 512, max: 2048, step: 16 };
  const [ttsText, setTtsText] = useState("The tools that feel simplest often hide the most thoughtful systems.");
  const [voiceOptions, setVoiceOptions] = useState<CatalogOption[]>(FALLBACK_VOICE_OPTIONS);
  const [customVoices, setCustomVoices] = useState<VoiceSample[]>(demo ? DEMO_VOICES : []);
  const [voiceError, setVoiceError] = useState("");
  const [voice, setVoice] = useState(FALLBACK_VOICE_OPTIONS[0].value);
  const [speed, setSpeed] = useState(1);
  const [videoStyle, setVideoStyle] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [runState, setRunState] = useState<RunState>("idle");
  const [job, setJob] = useState<PlaygroundJob | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollController = useRef<AbortController | null>(null);
  const hasVoiceAccess = canUseProduct(user, "tts");

  useEffect(() => {
    if (demo || initialKeys !== undefined) return;
    const controller = new AbortController();
    dashboardRequest<{ keys?: ApiKeyRecord[] }>("/api/auth/keys", { signal: controller.signal })
      .then((payload) => setKeys((payload.keys || []).filter((key) => key.is_active)))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "API keys could not be loaded.");
      });
    return () => controller.abort();
  }, [demo, initialKeys]);

  useEffect(() => {
    if (demo || !hasVoiceAccess) return;
    const controller = new AbortController();

    if (hasVoiceAccess) dashboardRequest<unknown>("/api/playground/voices", { signal: controller.signal })
      .then((payload) => {
        const options = normalizeVoiceOptions(payload);
        if (!options.length) return;
        setVoiceOptions(options);
      })
      .catch(() => {
        // Keep the bundled presets when the live catalogue is unavailable.
      });

    return () => controller.abort();
  }, [demo, hasVoiceAccess]);

  useEffect(() => {
    if (demo || !hasVoiceAccess || service !== "tts") return;
    const controller = new AbortController();
    function loadCustomVoices() {
      dashboardRequest<{ voices?: VoiceSample[] }>("/api/voices", { signal: controller.signal, cache: "no-store" })
        .then((payload) => {
          setCustomVoices(payload.voices || []);
          setVoiceError("");
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted) return;
          setVoiceError(requestError instanceof Error ? requestError.message : "Your saved voices could not be loaded.");
        });
    }
    loadCustomVoices();
    window.addEventListener("focus", loadCustomVoices);
    return () => {
      controller.abort();
      window.removeEventListener("focus", loadCustomVoices);
    };
  }, [demo, hasVoiceAccess, service]);

  const serviceKeys = useMemo(
    () => keys.filter((key) => keyMatchesProduct(key, service) && key.is_active),
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
    if (service === "image2image") return { prompt, width, height, image1_path: sourceImage.trim(), image2_path: referenceImage.trim() || undefined };
    return { prompt, width, height };
  }, [generateAudio, imageSize, prompt, service, speed, ttsText, videoStyle, voice, sourceImage, referenceImage]);

  const creatorRequired = service === "video" && !canUseProduct(user, "video");
  const paidRequired = !canUseProduct(user, service);

  function changeService(nextService: Service) {
    pollController.current?.abort();
    setService(nextService);
    setSelectedKey("");
    setRunState("idle");
    setJob(null);
    setGenerationId(null);
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
    setGenerationId(null);
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
      setGenerationId(accepted.generation_id || null);
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
                  {item === "video" && !canUseProduct(user, "video") ? <span>Creator</span> : null}
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

            {(service === "image" || service === "image2image") ? (
              <>
                {service === "image2image" ? (
                  <>
                    <label className="field-label" htmlFor="source-image">Source image URL</label>
                    <input id="source-image" type="url" required placeholder="https://example.com/source.png" value={sourceImage} onChange={(event) => setSourceImage(event.target.value)} />
                    <label className="field-label" htmlFor="reference-image">Second reference image URL (optional)</label>
                    <input id="reference-image" type="url" placeholder="https://example.com/reference.png" value={referenceImage} onChange={(event) => setReferenceImage(event.target.value)} />
                  </>
                ) : null}
                <label className="field-label" htmlFor="image-prompt">{service === "image2image" ? "Editing instructions" : "Prompt"}</label>
                <textarea id="image-prompt" maxLength={2000} onChange={(event) => setPrompt(event.target.value)} rows={5} value={prompt} />
                <label className="field-label" htmlFor="image-size">Canvas</label>
                <select id="image-size" onChange={(event) => {
                  if (!event.target.value) return;
                  const [width, height] = event.target.value.split("x");
                  setImageWidth(width);
                  setImageHeight(height);
                }} value={IMAGE_PRESETS.includes(imageSize) ? imageSize : ""}>
                  <option value="1024x1024">Square · 1024 × 1024</option>
                  <option value="1344x768">Landscape · 1344 × 768</option>
                  <option value="768x1344">Portrait · 768 × 1344</option>
                  <option value="" disabled>Custom dimensions</option>
                </select>
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="image-width">Width (px)</label><input id="image-width" type="number" required {...dimensionLimits} aria-describedby="canvas-help" value={imageWidth} onChange={(event) => setImageWidth(event.target.value)} /></div>
                  <div><label className="field-label" htmlFor="image-height">Height (px)</label><input id="image-height" type="number" required {...dimensionLimits} aria-describedby="canvas-help" value={imageHeight} onChange={(event) => setImageHeight(event.target.value)} /></div>
                </div>
                <small id="canvas-help" className="muted">{service === "image" ? "Each dimension must be 512–2048 pixels, in multiples of 16." : "Each dimension must be a whole number from 32–4096 pixels."}</small>
              </>
            ) : null}

            {service === "tts" ? (
              <>
                <label className="field-label" htmlFor="tts-text">Text</label>
                <textarea id="tts-text" maxLength={10000} onChange={(event) => setTtsText(event.target.value)} rows={5} value={ttsText} />
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="tts-voice">Voice</label><select id="tts-voice" onChange={(event) => setVoice(event.target.value)} value={voice}>
                    {!voiceOptions.some((option) => option.value === voice) && !customVoices.some((sample) => sample.id === voice) ? <option disabled value={voice}>Selected voice unavailable — choose a voice</option> : null}
                    <optgroup label="Preset voices">{voiceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
                    {customVoices.length ? <optgroup label="Your voices">{customVoices.map((sample) => <option key={sample.id} value={sample.id}>{sample.name} · {sample.language.toUpperCase()}</option>)}</optgroup> : null}
                  </select></div>
                  <div><label className="field-label" htmlFor="tts-speed">Speed · {speed.toFixed(1)}×</label><input id="tts-speed" max="1.5" min="0.7" onChange={(event) => setSpeed(Number(event.target.value))} step="0.1" type="range" value={speed} /></div>
                </div>
                {voiceError ? <div className="inline-notice inline-notice--warning" role="alert"><WarningIcon /> Saved voices could not be loaded: {voiceError}</div> : null}
              </>
            ) : null}

            {service === "video" ? (
              <>
                <label className="field-label" htmlFor="video-prompt">Scene prompt</label>
                <textarea id="video-prompt" maxLength={2000} onChange={(event) => setPrompt(event.target.value)} rows={5} value={prompt} />
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="video-style">Style</label><select id="video-style" onChange={(event) => setVideoStyle(event.target.value)} value={videoStyle}>{VIDEO_STYLE_OPTIONS.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></div>
                  <label className="checkbox-card"><input checked={generateAudio} onChange={(event) => setGenerateAudio(event.target.checked)} type="checkbox" /><span><strong>Generate audio</strong><small>Return a video with model-generated sound.</small></span></label>
                </div>
              </>
            ) : null}


            {!serviceKeys.length ? <div className="inline-notice inline-notice--warning"><WarningIcon /> Create an active {SERVICE_META[service].label.toLowerCase()} key first. <Link href="/api-keys">Open API keys</Link></div> : null}
            {paidRequired ? <div className="inline-notice inline-notice--warning"><WarningIcon /> Your plan does not include this product. <Link href="/subscription">View plans</Link></div> : null}
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
            {runState === "completed" && output && (service === "image" || service === "image2image") ? <Image alt="Generated playground result" className="playground-image-result" height={1024} src={output} unoptimized width={1024} /> : null}
            {runState === "completed" && output && service === "tts" ? <audio className="playground-audio-result" controls src={output} /> : null}
            {runState === "completed" && output && service === "video" ? <video className="playground-video-result" controls src={output} /> : null}
            {runState === "completed" && output ? <PlaygroundDownload key={output} output={output} generationId={generationId} service={service} /> : null}
            {runState === "completed" && !output && !demo ? <div className="demo-output"><strong>Job completed</strong><p>The service completed without a previewable output URL.</p></div> : null}
            {runState === "failed" ? <div className="output-error"><WarningIcon /><p>{error || job?.error || "This request failed."}</p></div> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
