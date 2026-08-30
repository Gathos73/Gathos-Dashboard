"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CopyIcon,
  PlayIcon,
  TrashIcon,
  UploadIcon,
  VoiceIcon,
  WarningIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import { DEMO_VOICES } from "@/lib/demo-data";
import type { VoiceSample } from "@/lib/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);
const LANGUAGES = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
  ["zh", "Chinese"],
  ["ko", "Korean"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["ru", "Russian"],
  ["ar", "Arabic"],
] as const;

const PRESET_VOICES = [
  { id: "josh", name: "Josh", tone: "Clear & steady", use: "Explainers and product demos", color: "violet" },
  { id: "koko", name: "Koko", tone: "Warm & natural", use: "Stories and friendly narration", color: "amber" },
  { id: "pixxy", name: "Pixxy", tone: "Bright & energetic", use: "Hooks, promos, and social", color: "blue" },
  { id: "prof", name: "Prof", tone: "Direct & composed", use: "Education and technical guides", color: "green" },
  { id: "rochie", name: "Rochie", tone: "Grounded & expressive", use: "Walkthroughs and storytelling", color: "rose" },
  { id: "spraky", name: "Spraky", tone: "Lively & playful", use: "Ads and character reads", color: "violet" },
] as const;

type RecorderProps = { disabled: boolean; onRecorded: (file: File | null) => void };

function VoiceRecorder({ disabled, onRecorded }: RecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanupStream() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(() => () => {
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function stopRecording() {
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
  }

  async function startRecording() {
    setError("");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = nextStream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(nextStream, { mimeType });
      mediaRecorder.current = recorder;
      chunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        const extension = mimeType.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `voice-recording.${extension}`, { type: mimeType });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecording(false);
        onRecorded(file);
        cleanupStream();
      };
      recorder.start();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setElapsed((current) => {
          if (current >= 29) stopRecording();
          return Math.min(30, current + 1);
        });
      }, 1000);
    } catch (recordError) {
      cleanupStream();
      setError(
        recordError instanceof DOMException && recordError.name === "NotAllowedError"
          ? "Microphone access was denied. Allow access in your browser settings and try again."
          : "This browser could not start an audio recording.",
      );
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setElapsed(0);
    setError("");
    onRecorded(null);
  }

  if (previewUrl) {
    return (
      <div className="recorder-ready">
        <div><CheckIcon /><span>Recording ready · {elapsed}s</span></div>
        <audio controls preload="metadata" src={previewUrl} />
        <button className="text-button" disabled={disabled} onClick={reset} type="button">Record again</button>
      </div>
    );
  }

  return (
    <div className={`voice-recorder ${recording ? "is-recording" : ""}`}>
      <span className="record-dot"><VoiceIcon /></span>
      <div>
        <strong>{recording ? "Recording your sample" : "Record in the browser"}</strong>
        <p>{recording ? `${elapsed}s of 30s · Read at a natural pace` : "Use 5–30 seconds of clean speech in a quiet room."}</p>
      </div>
      <button
        className={recording ? "button button-danger" : "button button-secondary"}
        disabled={disabled}
        onClick={recording ? stopRecording : startRecording}
        type="button"
      >
        {recording ? "Stop" : "Start recording"}
      </button>
      {error ? <p className="recorder-error" role="alert">{error}</p> : null}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function languageLabel(code: string): string {
  return LANGUAGES.find(([value]) => value === code)?.[1] || code.toUpperCase();
}

function validAudioFile(file: File): boolean {
  return /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name) || ALLOWED_AUDIO_MIME_TYPES.has(file.type);
}

export function VoicesManager({ demo }: { demo: boolean }) {
  const [tab, setTab] = useState<"custom" | "presets">("custom");
  const [voices, setVoices] = useState<VoiceSample[]>(demo ? DEMO_VOICES : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [refText, setRefText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    dashboardRequest<{ voices?: VoiceSample[] }>("/api/voices", { signal: controller.signal })
      .then((payload) => setVoices(payload.voices || []))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Voices could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demo]);

  useEffect(() => () => audio.current?.pause(), []);

  function selectFile(nextFile: File | null) {
    setError("");
    setSuccess("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!validAudioFile(nextFile)) {
      setError("Choose an MP3, WAV, M4A, OGG, or WebM audio file.");
      return;
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError("Voice samples must be 10 MB or smaller.");
      return;
    }
    setFile(nextFile);
    if (!name) setName(nextFile.name.replace(/\.[^.]+$/, ""));
  }

  async function saveVoice() {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      let voice: VoiceSample;
      if (demo) {
        voice = {
          content_type: file.type,
          created_at: new Date().toISOString(),
          file_size: file.size,
          id: crypto.randomUUID(),
          language,
          name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
          ref_text: refText.trim() || null,
        };
      } else {
        const formData = new FormData();
        formData.append("audio", file);
        formData.append("name", name.trim() || file.name.replace(/\.[^.]+$/, ""));
        formData.append("language", language);
        if (refText.trim()) formData.append("ref_text", refText.trim());
        voice = await dashboardRequest<VoiceSample>("/api/voices/upload", { body: formData, method: "POST" });
      }
      setVoices((current) => [voice, ...current]);
      setFile(null);
      setName("");
      setRefText("");
      if (fileInput.current) fileInput.current.value = "";
      setSuccess(`${voice.name} is ready to use in TTS requests.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The voice sample could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  async function playVoice(voice: VoiceSample) {
    setError("");
    if (demo) {
      setError("Playback uses signed audio URLs and is unavailable in local demo mode.");
      return;
    }
    try {
      setPlaying(voice.id);
      const payload = await dashboardRequest<{ url?: string }>(`/api/voices/${voice.id}/url`);
      if (!payload.url) throw new Error("A playback URL was not returned.");
      audio.current?.pause();
      const player = new Audio(payload.url);
      audio.current = player;
      player.onended = () => setPlaying(null);
      player.onerror = () => {
        setPlaying(null);
        setError("This voice sample could not be played.");
      };
      await player.play();
    } catch (requestError) {
      setPlaying(null);
      setError(requestError instanceof Error ? requestError.message : "This voice sample could not be played.");
    }
  }

  async function deleteVoice(id: string) {
    setError("");
    try {
      if (!demo) await dashboardRequest<{ ok: boolean }>(`/api/voices/${id}`, { method: "DELETE" });
      setVoices((current) => current.filter((voice) => voice.id !== id));
      setConfirmDelete(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The voice sample could not be deleted.");
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div>
      <PageHeader
        actions={
          <div className="segmented-control" role="group" aria-label="Voice library section">
            <button aria-pressed={tab === "custom"} className={tab === "custom" ? "is-active" : ""} onClick={() => setTab("custom")} type="button">Your voices</button>
            <button aria-pressed={tab === "presets"} className={tab === "presets" ? "is-active" : ""} onClick={() => setTab("presets")} type="button">Preset voices</button>
          </div>
        }
        description="Save reference audio once, then use the voice name in every text-to-speech request."
        eyebrow="Voice library"
        title="Voices"
      />

      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}
      {success ? <div className="inline-notice inline-notice--success"><CheckIcon /> {success}</div> : null}

      {tab === "custom" ? (
        <>
          <section className="panel voice-uploader">
            <div className="panel-heading voice-uploader-heading">
              <div><p className="panel-kicker">Add a voice</p><h2>Upload or record a clean sample</h2></div>
              <div className="mini-tabs" role="group" aria-label="Voice input method">
                <button aria-pressed={mode === "upload"} className={mode === "upload" ? "is-active" : ""} onClick={() => { setMode("upload"); setFile(null); }} type="button"><UploadIcon /> Upload</button>
                <button aria-pressed={mode === "record"} className={mode === "record" ? "is-active" : ""} onClick={() => { setMode("record"); setFile(null); }} type="button"><VoiceIcon /> Record</button>
              </div>
            </div>

            <div className="voice-fields-grid">
              <div><label className="field-label" htmlFor="voice-name">Voice name</label><input id="voice-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. maya-warm" value={name} /></div>
              <div><label className="field-label" htmlFor="voice-language">Reference language</label><select id="voice-language" onChange={(event) => setLanguage(event.target.value)} value={language}>{LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
            <label className="field-label" htmlFor="voice-transcript">Exact transcript <span>Optional, improves cloning</span></label>
            <textarea id="voice-transcript" maxLength={500} onChange={(event) => setRefText(event.target.value)} placeholder="Type the exact words spoken in the recording…" rows={2} value={refText} />

            {mode === "upload" ? (
              <div
                className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0] || null); }}
              >
                <label className="sr-only" htmlFor="voice-audio-file">Reference audio file</label>
                <input accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" className="sr-only" id="voice-audio-file" onChange={(event) => selectFile(event.target.files?.[0] || null)} ref={fileInput} type="file" />
                <span className="drop-zone-icon"><UploadIcon /></span>
                <div>
                  <strong>{file ? file.name : "Drop your reference audio here"}</strong>
                  <p>{file ? `${formatSize(file.size)} · ready to save` : "MP3, WAV, M4A, OGG, or WebM · up to 10 MB"}</p>
                </div>
                <button className="button button-secondary" onClick={() => fileInput.current?.click()} type="button">{file ? "Replace file" : "Choose file"}</button>
              </div>
            ) : <VoiceRecorder disabled={uploading} onRecorded={selectFile} />}

            <div className="uploader-footer">
              <p><span className="status-dot" /> For best results, match the reference and target languages.</p>
              <button className="button button-primary" disabled={!file || uploading} onClick={saveVoice} type="button">
                {uploading ? "Saving voice…" : "Save voice"}
              </button>
            </div>
          </section>

          <section className="panel voice-library-panel">
            <div className="panel-heading"><div><p className="panel-kicker">Custom library</p><h2>Your saved voices</h2></div><span className="count-badge">{voices.length}</span></div>
            {loading ? <div className="voice-list">{Array.from({ length: 2 }, (_, index) => <div className="skeleton skeleton-voice-row" key={index} />)}</div> : voices.length ? (
              <div className="voice-list">
                {voices.map((voice) => (
                  <article className="voice-row" key={voice.id}>
                    <button aria-label={`Play ${voice.name}`} className="voice-play-button" disabled={playing === voice.id} onClick={() => playVoice(voice)} type="button">{playing === voice.id ? <span className="button-spinner" /> : <PlayIcon />}</button>
                    <div className="voice-row-copy"><div><strong>{voice.name}</strong><span className="status-badge status-badge--violet">{languageLabel(voice.language)}</span></div><p>{formatSize(voice.file_size)} · Added {formatDate(voice.created_at)}{voice.ref_text ? ` · “${voice.ref_text}”` : ""}</p></div>
                    <button className="copy-chip" onClick={() => copyValue(voice.name)} type="button">{copied === voice.name ? <CheckIcon /> : <CopyIcon />}<code>{voice.name}</code></button>
                    {confirmDelete === voice.id ? <div className="delete-actions"><button className="text-button" onClick={() => setConfirmDelete(null)} type="button">Cancel</button><button className="button button-danger button-small" onClick={() => deleteVoice(voice.id)} type="button">Delete</button></div> : <button aria-label={`Delete ${voice.name}`} className="icon-button key-delete-button" onClick={() => setConfirmDelete(voice.id)} type="button"><TrashIcon /></button>}
                  </article>
                ))}
              </div>
            ) : <div className="service-empty"><span className="service-icon service-icon--blue"><VoiceIcon /></span><h3>No custom voices yet</h3><p>Upload clean reference audio above to create your first reusable voice.</p></div>}
          </section>
        </>
      ) : (
        <section className="preset-grid" aria-label="Preset voices">
          {PRESET_VOICES.map((voice) => (
            <article className="panel preset-card" key={voice.id}>
              <div className="preset-card-top"><span className={`preset-avatar preset-avatar--${voice.color}`}>{voice.name.charAt(0)}</span><button aria-label={`Copy ${voice.id} API voice ID`} className="icon-button" onClick={() => copyValue(voice.id)} type="button">{copied === voice.id ? <CheckIcon /> : <CopyIcon />}</button></div>
              <h2>{voice.name}</h2><p>{voice.tone}</p><small>{voice.use}</small><div className="preset-id"><span>API voice ID</span><code>{voice.id}</code></div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
