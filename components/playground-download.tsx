"use client";

import { useState } from "react";
import { dashboardRequest } from "@/lib/client-api";
import { safeDownload, type GenerationDetail } from "@/lib/generations";

export function PlaygroundDownload({ output, generationId, service }: {
  output: string;
  generationId: string | null;
  service: "image" | "image2image" | "tts" | "video";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let href = output;
      let filename: string | null | undefined;
      // Stored assets use the authenticated download route, avoiding storage CORS.
      // Inline outputs can be saved immediately, even before archival finishes.
      if (generationId && !output.startsWith("data:")) {
        const generation = await dashboardRequest<GenerationDetail>(
          `/api/generations/${encodeURIComponent(generationId)}`, { cache: "reload" },
        ).catch(() => null);
        const asset = generation?.outputs.find((item) => item.role === "primary") || generation?.outputs[0];
        href = safeDownload(asset?.download_path || generation?.download_path || null) || output;
        filename = asset?.filename;
      }
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Unable to download this asset. Please try again.");
      const blob = await response.blob();
      const extension = ({
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
        "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm",
        "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3",
      } as Record<string, string>)[blob.type.split(";")[0]]
        || (service === "video" ? "mp4" : service === "tts" ? "wav" : "png");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || `gathos-${service}-${generationId || "output"}.${extension}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("The asset could not be downloaded. Please try again once it has been saved to generation history.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="generation-download">
    <button type="button" className="button button-secondary" disabled={busy} onClick={download}>{busy ? "Downloading…" : "Download asset"}</button>
    {error ? <p className="generation-download-error" role="alert">{error}</p> : null}
  </div>;
}
