"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CopyIcon,
  PlayIcon,
  TrashIcon,
  PlusIcon,
  VoiceIcon,
  WarningIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import { DEMO_VOICES } from "@/lib/demo-data";
import { readDemoVoices, removeDemoVoice } from "@/lib/demo-voices";
import { formatDate, formatSize, languageLabel } from "@/lib/voices";
import type { VoiceSample } from "@/lib/types";

type PresetVoice = {
  id: string;
  name: string;
  description: string;
  bestUse: string;
  sampleUrl?: string;
};

const PRESET_COLORS = ["violet", "amber", "blue", "green", "rose"] as const;

export function VoicesManager({ demo, initialVoices }: { demo: boolean; initialVoices?: VoiceSample[] }) {
  const [presets, setPresets] = useState<PresetVoice[]>([]);
  const [presetStatus, setPresetStatus] = useState<"loading" | "ready" | "error">("loading");
  const [presetError, setPresetError] = useState("");
  const [presetAttempt, setPresetAttempt] = useState(0);
  const [tab, setTab] = useState<"custom" | "presets">("custom");
  const [voices, setVoices] = useState<VoiceSample[]>(demo ? DEMO_VOICES : (initialVoices ?? []));
  const [loading, setLoading] = useState(!demo && initialVoices === undefined);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (demo) {
      let active = true;
      Promise.resolve().then(() => { if (active) setVoices(readDemoVoices()); });
      return () => { active = false; };
    }
    if (initialVoices !== undefined) return;
    const controller = new AbortController();
    dashboardRequest<{ voices?: VoiceSample[] }>("/api/voices", { signal: controller.signal })
      .then((payload) => setVoices(payload.voices || []))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Voices could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demo, initialVoices]);

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<{ voices: PresetVoice[] }>("/api/voices/presets", { signal: controller.signal, cache: "no-store" })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(payload.voices)) throw new Error("The voice catalog response was invalid.");
        setPresets(payload.voices);
        setPresetStatus("ready");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setPresetError(requestError instanceof Error ? requestError.message : "Preset voices could not be loaded.");
        setPresetStatus("error");
      });
    return () => controller.abort();
  }, [presetAttempt]);

  useEffect(() => () => audio.current?.pause(), []);

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
      if (demo) removeDemoVoice(id);
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
          <>
            <Link className="button button-primary" href="/voices/new"><PlusIcon /> Add a voice</Link>
            <div className="segmented-control" role="group" aria-label="Voice library section">
              <button aria-pressed={tab === "custom"} className={tab === "custom" ? "is-active" : ""} onClick={() => setTab("custom")} type="button">Your voices</button>
              <button aria-pressed={tab === "presets"} className={tab === "presets" ? "is-active" : ""} onClick={() => setTab("presets")} type="button">Preset voices</button>
            </div>
          </>
        }
        description="Save reference audio once, then use the voice name in every text-to-speech request."
        eyebrow="Voice library"
        title="Voices"
      />

      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}

      {tab === "custom" ? (
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
          ) : <div className="service-empty"><span className="service-icon service-icon--blue"><VoiceIcon /></span><h3>No custom voices yet</h3><p>Upload or record a sample to create your first reusable voice.</p><Link className="button button-primary" href="/voices/new"><PlusIcon /> Add a voice</Link></div>}
        </section>
      ) : (
        <section className="preset-grid" aria-label="Preset voices">
          {presetStatus === "loading" ? <p role="status">Loading preset voices…</p> : null}
          {presetStatus === "error" ? (
            <div className="inline-notice inline-notice--danger" role="alert">
              <WarningIcon /> {presetError}
              <button className="button button-secondary" onClick={() => { setPresetStatus("loading"); setPresetAttempt((attempt) => attempt + 1); }} type="button">Retry</button>
            </div>
          ) : null}
          {presetStatus === "ready" && presets.length === 0 ? <p>No preset voices are available.</p> : null}
          {presets.map((voice, index) => (
            <article className="panel preset-card" key={voice.id}>
              <div className="preset-card-top"><span className={`preset-avatar preset-avatar--${PRESET_COLORS[index % PRESET_COLORS.length]}`}>{voice.name.charAt(0)}</span><button aria-label={`Copy ${voice.id} API voice ID`} className="icon-button" onClick={() => copyValue(voice.id)} type="button">{copied === voice.id ? <CheckIcon /> : <CopyIcon />}</button></div>
              <h2>{voice.name}</h2><p>{voice.description}</p><small>{voice.bestUse}</small><div className="preset-id"><span>API voice ID</span><code>{voice.id}</code></div>
              {voice.sampleUrl ? <audio
                aria-label={`Preview ${voice.name}`}
                className="preset-preview"
                controls
                preload="none"
                src={voice.sampleUrl}
                onPlay={(event) => {
                  if (audio.current !== event.currentTarget) audio.current?.pause();
                  audio.current = event.currentTarget;
                  setPlaying(null);
                  setError("");
                }}
                onError={() => setError(`${voice.name}'s preview could not be played. Please try again.`)}
              /> : <p>Preview unavailable</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
