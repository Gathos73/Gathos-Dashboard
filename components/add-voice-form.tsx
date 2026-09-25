"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ArrowLeftIcon, CheckIcon, UploadIcon, VoiceIcon, WarningIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import { saveDemoVoice } from "@/lib/demo-voices";
import { formatSize, LANGUAGES } from "@/lib/voices";
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

function validAudioFile(file: File): boolean {
  return /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name) || ALLOWED_AUDIO_MIME_TYPES.has(file.type);
}

export function AddVoiceForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [refText, setRefText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function selectFile(nextFile: File | null) {
    setError("");
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
      if (demo) saveDemoVoice(voice);
      setFile(null);
      setName("");
      setRefText("");
      if (fileInput.current) fileInput.current.value = "";
      router.push("/voices");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The voice sample could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        actions={<Link className="button button-secondary" href="/voices"><ArrowLeftIcon /> Back to voices</Link>}
        description="Upload or record clean reference audio to create a reusable voice."
        eyebrow="Voice library"
        title="Add a voice"
      />
      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}
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
    </div>
  );
}
