"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DownloadOutput } from "./download-output";
import { PageHeader } from "./page-header";
import { dashboardRequest } from "@/lib/client-api";
import { generationDate, humanize, isPending, type GenerationList } from "@/lib/generations";

export function GenerationStatus({ status }: { status: string }) {
  const tone = status === "succeeded" ? "status-badge--success" : ["failed", "expired", "orphaned", "lease_expired"].includes(status) ? "status-badge--danger" : isPending(status) ? "status-badge--violet" : "";
  return <span className={`status-badge ${tone}`}>{humanize(status)}</span>;
}

export function GenerationHistory({ initialData }: { initialData?: GenerationList | null }) {
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "", product: "" });
  const [products, setProducts] = useState<Array<{ code: string; name: string }>>([]);
  const [productsError, setProductsError] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const path = `/api/generations?${new URLSearchParams({ limit: "25", offset: String(offset), ...(appliedFilters.status ? { status_group: appliedFilters.status } : {}), ...(appliedFilters.product ? { product: appliedFilters.product } : {}) })}`;
  const requestKey = `${path}:${refresh}`;
  const initialRequestKey = useRef(requestKey).current;
  const hasInitialData = Boolean(initialData && requestKey === initialRequestKey);
  const [result, setResult] = useState<{ key: string; data?: GenerationList; error?: string }>(
    initialData ? { key: requestKey, data: initialData } : { key: "" },
  );
  const current = result.key === requestKey ? result : hasInitialData ? { data: initialData, error: undefined } : null;
  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<{ products: Array<{ code: string; name: string }> }>("/api/generations/products", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setProducts(data.products); setProductsError(""); } })
      .catch((error: unknown) => { if (!controller.signal.aborted) setProductsError(error instanceof Error ? error.message : "Unable to load products."); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (hasInitialData) return;
    const controller = new AbortController();
    async function load() {
      try {
        const data = await dashboardRequest<GenerationList>(path, { signal: controller.signal, cache: refresh === 0 ? "default" : "reload" });
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResult((prior) => ({ key: requestKey, data: prior.key === requestKey ? prior.data : undefined, error: cause instanceof Error ? cause.message : "Unable to load generations." }));
      }
    }
    void load();
    return () => controller.abort();
  }, [path, requestKey, hasInitialData, refresh]);
  return <div className="generation-page">
    <PageHeader title="Generations" eyebrow="Your work" description="Track requests, inspect errors, and retrieve your generated files. Use Refresh to get the latest status."
      actions={<button className="button button-secondary" type="button" onClick={() => { setRefresh((value) => value + 1); }}>Refresh</button>} />
    <form className="panel generation-filters" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ status, product }); setOffset(0); }}>
      <label>Product<select value={product} onChange={(event) => setProduct(event.target.value)}><option value="">All products</option>{products.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="in_progress">In progress</option></select></label>
      <button type="submit" className="button button-secondary">Apply filters</button>
    </form>
    {productsError ? <div className="inline-notice inline-notice--danger" role="alert">{productsError} <button type="button" className="button button-secondary" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div> : null}
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
