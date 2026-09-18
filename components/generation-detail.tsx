"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DownloadOutput } from "./download-output";
import { ArrowLeftIcon } from "./icons";
import { PageHeader } from "./page-header";
import { GenerationStatus } from "./generation-history";
import { clearRequestCache } from "@/lib/request-cache";
import { dashboardRequest } from "@/lib/client-api";
import { generationDate, humanize, isPending, type GenerationDetail as Detail } from "@/lib/generations";

export function GenerationDetail({ id, initialData }: { id: string; initialData?: Detail | null }) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${id}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: Detail; error?: string }>(
    initialData ? { key: requestKey, data: initialData } : { key: "" },
  );
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const current = result.key === requestKey ? result : null;
  const row = current?.data;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstLoad = !initialData;
    async function load() {
      try {
        const data = await dashboardRequest<Detail>(`/api/generations/${encodeURIComponent(id)}`, { signal: controller.signal, cache: firstLoad ? "default" : "reload" });
        firstLoad = false;
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data });
        if (isPending(data.status)) timer = setTimeout(load, 5_000);
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: cause instanceof Error ? cause.message : "Unable to load this generation." });
      }
    }
    if (initialData && revision === 0) {
      if (isPending(initialData.status)) timer = setTimeout(load, 5_000);
    } else {
      void load();
    }
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, initialData, requestKey, revision]);
  async function retry() {
    if (!row?.can_retry || retrying) return;
    setRetrying(true); setActionError(""); setNotice("");
    try {
      await dashboardRequest(`/api/generations/${encodeURIComponent(id)}/retry`, { method: "POST" });
      setNotice("Retry queued. This remains the same generation.");
      setRevision((value) => value + 1);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to retry."); }
    finally { setRetrying(false); }
  }
  return <div className="generation-page">
    <Link href="/generations" className="text-button"><ArrowLeftIcon size={14} /> All generations</Link>
    <PageHeader title={row?.title || row?.product_name || "Generation details"} eyebrow="Generation" description="Request details, execution attempts, and output files."
      actions={<button className="button button-secondary" onClick={() => { clearRequestCache(); setRevision((value) => value + 1); }}>Refresh</button>} />
    {current?.error || actionError ? <div className="inline-notice inline-notice--danger" role="alert">{current?.error || actionError}</div> : null}
    {notice ? <div className="inline-notice inline-notice--success" role="status">{notice}</div> : null}
    {!current ? <div className="panel generation-empty" role="status">Loading generation…</div> : null}
    {row ? <>
      <section className="panel generation-card"><div className="generation-card-heading"><h2>Request status</h2><GenerationStatus status={row.status} /></div>
        {isPending(row.status) ? <div className="generation-progress"><progress aria-label="Generation progress" value={row.progress} max={100} /><span>{row.progress}%</span></div> : null}
        <dl className="generation-facts"><div><dt>Generation ID</dt><dd>{row.id}</dd></div><div><dt>Product</dt><dd>{row.product_name} ({row.product_code})</dd></div><div><dt>Source</dt><dd>{humanize(row.source)}</dd></div><div><dt>API key</dt><dd>{row.api_key_name || "None"}</dd></div><div><dt>Created</dt><dd>{generationDate(row.created_at)}</dd></div><div><dt>Accepted</dt><dd>{generationDate(row.accepted_at)}</dd></div><div><dt>Started</dt><dd>{generationDate(row.started_at)}</dd></div><div><dt>Completed</dt><dd>{generationDate(row.completed_at)}</dd></div></dl>
        {row.latest_error_code || row.latest_error_message ? <div className="generation-error" role="status"><strong>{row.latest_error_code || "Generation error"}</strong><p>{row.latest_error_message}</p></div> : null}
        <div className="generation-actions"><button className="button button-primary" disabled={!row.can_retry || retrying} onClick={retry}>{retrying ? "Queuing retry…" : "Retry generation"}</button>{!row.can_retry ? <span className="muted">{isPending(row.status) ? "Wait for this attempt to finish." : "Retry is not available for this generation."}</span> : null}</div>
      </section>
      <section className="panel generation-card"><h2>Outputs</h2>{row.outputs.length ? <ul className="generation-outputs">{row.outputs.map((output) => <li key={`${output.asset_id}:${output.role}:${output.ordinal}`}><div><strong>{output.filename || `${humanize(output.role)} ${output.ordinal + 1}`}</strong><p>{output.mime_type || "Generated file"}{output.size_bytes != null ? ` · ${output.size_bytes.toLocaleString()} bytes` : ""}</p></div><DownloadOutput path={output.download_path} filename={output.filename} /></li>)}</ul> : <p>{row.status === "succeeded" ? "This generation completed, but no output file was saved. The original result may no longer be available." : isPending(row.status) ? "Output files will appear after processing finishes." : "No output files are available for this generation."}</p>}</section>
      <section className="panel generation-card"><h2>Input data</h2><pre className="generation-json">{JSON.stringify(row.input_payload, null, 2)}</pre></section>
      <section className="panel generation-card"><h2>Attempts ({row.attempts.length})</h2>{row.attempts.length ? row.attempts.map((attempt) => <article className="generation-attempt" key={attempt.id}><div className="generation-card-heading"><h3>Attempt {attempt.attempt_number} · {humanize(attempt.trigger_kind)}</h3><GenerationStatus status={attempt.status} /></div><p>Created {generationDate(attempt.created_at)} · Completed {generationDate(attempt.completed_at)}</p>{attempt.error_code || attempt.error_message ? <p className="generation-error"><strong>{attempt.error_code}</strong> {attempt.error_message}</p> : null}</article>) : <p>No provider attempt has started.</p>}</section>
    </> : null}
  </div>;
}
