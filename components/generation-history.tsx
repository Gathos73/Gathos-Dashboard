"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DownloadOutput } from "./download-output";
import { PageHeader } from "./page-header";
import { clearRequestCache } from "@/lib/request-cache";
import { dashboardRequest } from "@/lib/client-api";
import { GENERATION_STATUSES, generationDate, humanize, isPending, type GenerationList } from "@/lib/generations";

export function GenerationStatus({ status }: { status: string }) {
  const tone = status === "succeeded" ? "status-badge--success" : ["failed", "expired", "orphaned", "lease_expired"].includes(status) ? "status-badge--danger" : isPending(status) ? "status-badge--violet" : "";
  return <span className={`status-badge ${tone}`}>{humanize(status)}</span>;
}

export function GenerationHistory({ initialData }: { initialData?: GenerationList | null }) {
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const path = `/api/generations?${new URLSearchParams({ limit: "25", offset: String(offset), ...(status ? { status } : {}), ...(filterProduct ? { product: filterProduct } : {}) })}`;
  const requestKey = `${path}:${refresh}`;
  const initialRequestKey = useRef(requestKey).current;
  const hasInitialData = Boolean(initialData && requestKey === initialRequestKey);
  const [result, setResult] = useState<{ key: string; data?: GenerationList; error?: string }>(
    initialData ? { key: requestKey, data: initialData } : { key: "" },
  );
  const current = result.key === requestKey ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstLoad = !hasInitialData;
    async function load() {
      try {
        const data = await dashboardRequest<GenerationList>(path, { signal: controller.signal, cache: firstLoad ? "default" : "reload" });
        firstLoad = false;
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data });
        timer = setTimeout(load, 10_000);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResult((prior) => ({ key: requestKey, data: prior.key === requestKey ? prior.data : undefined, error: cause instanceof Error ? cause.message : "Unable to load generations." }));
      }
    }
    if (hasInitialData) timer = setTimeout(load, 10_000);
    else void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, requestKey, hasInitialData]);
  return <div className="generation-page">
    <PageHeader title="Generations" eyebrow="Your work" description="Track requests, inspect errors, and retrieve your generated files. Status refreshes automatically."
      actions={<button className="button button-secondary" type="button" onClick={() => { clearRequestCache(); setRefresh((value) => value + 1); }}>Refresh</button>} />
    <form className="panel generation-filters" onSubmit={(event) => { event.preventDefault(); setFilterProduct(product.trim()); setOffset(0); }}>
      <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All statuses</option>{GENERATION_STATUSES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
      <label>Product code<input value={product} placeholder="All products" onChange={(event) => setProduct(event.target.value)} /></label>
      <button type="submit" className="button button-secondary">Apply filters</button>
    </form>
    {current?.error ? <div className="inline-notice inline-notice--danger" role="alert">{current.error}</div> : null}
    {!current ? <div className="panel generation-empty" role="status">Loading generations…</div> : null}
    {current?.data?.generations.length === 0 ? <div className="panel generation-empty"><h2>No generations found</h2><p>Your requests will appear here. Try another filter or start in the playground.</p><Link className="button button-primary" href="/playground">Open playground</Link></div> : null}
    {current?.data?.generations.length ? <div className="panel table-scroll generation-table-wrap" role="region" aria-label="Generation history" tabIndex={0}>
      <table className="data-table generation-table">
        <thead><tr>{["Generation", "Product", "Status", "Created", "Attempts", "Outputs", "Actions"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{current.data.generations.map((row) => <tr key={row.id}>
          <td className="generation-table-title"><Link href={`/generations/${row.id}`}><strong>{row.title || `${row.product_name} generation`}</strong></Link><small>{row.api_key_name ? `Key: ${row.api_key_name}` : row.id}</small>{row.latest_error_message || row.latest_error_code ? <p className="generation-error">{row.latest_error_code ? <b>{row.latest_error_code}: </b> : null}{row.latest_error_message}</p> : null}</td>
          <td>{row.product_name}<small>{row.product_code}</small></td>
          <td><GenerationStatus status={row.status} />{isPending(row.status) ? <div className="generation-progress"><progress aria-label="Generation progress" value={row.progress} max={100} /><span>{row.progress}%</span></div> : null}</td>
          <td className="generation-table-date">{generationDate(row.created_at)}</td>
          <td>{row.attempt_count}</td><td>{row.output_count}</td>
          <td><div className="generation-table-actions"><Link className="button button-secondary" href={`/generations/${row.id}`}>{row.can_retry ? "Details & retry" : "View details"}</Link><DownloadOutput path={row.download_path} /></div></td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    {current?.data ? <nav className="generation-pagination" aria-label="Generation pages"><button className="button button-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button><span>{current.data.total ? `${offset + 1}–${offset + current.data.generations.length}` : "0"} of {current.data.total}</span><button className="button button-secondary" disabled={offset + 25 >= current.data.total} onClick={() => setOffset(offset + 25)}>Next</button></nav> : null}
  </div>;
}
