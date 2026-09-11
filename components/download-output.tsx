"use client";

import { useState } from "react";
import { safeDownload } from "@/lib/generations";

export function DownloadOutput({ path, filename }: { path: string | null; filename?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const href = safeDownload(path);
  if (!href) return null;

  async function download() {
    if (busy || !href) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Unable to download this output.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const extension = ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4", "audio/wav": ".wav", "audio/mpeg": ".mp3" } as Record<string, string>)[blob.type.split(";")[0]] || "";
      anchor.download = filename || `output-${href.split("/")[3]}${extension}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download this output.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="generation-download"><button type="button" className="button button-secondary" disabled={busy} onClick={download}>{busy ? "Downloading…" : "Download"}</button>{error ? <p className="generation-download-error" role="alert">{error}</p> : null}</div>;
}
