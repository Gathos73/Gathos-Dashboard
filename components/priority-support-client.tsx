"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "./page-header";
import {
  ArrowRightIcon,
  CheckIcon,
  PlaygroundIcon,
  PlusIcon,
  RefreshIcon,
  SupportIcon,
  WarningIcon,
} from "./icons";
import { clearRequestCache } from "@/lib/request-cache";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";
import type { ApiKeyRecord, DashboardUser, PrioritySupportTicket } from "@/lib/types";

type GenerationOption = {
  id: string;
  title?: string | null;
  product_code?: string;
  status: string;
  created_at: string;
  input_payload?: Record<string, unknown>;
};

const TIME_WINDOWS = [
  { label: "Last 1 hour", hours: 1 },
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
  { label: "All time", hours: 0 },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function PrioritySupportClient({
  demo,
  user,
}: {
  demo: boolean;
  user: DashboardUser;
}) {
  const hasPrioritySupport = Boolean(user.priority_support || user.plan_details?.priority_support);

  // Tickets state
  const [tickets, setTickets] = useState<PrioritySupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [timeWindowHours, setTimeWindowHours] = useState(24);
  const [generations, setGenerations] = useState<GenerationOption[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(false);
  const [selectedGenerationId, setSelectedGenerationId] = useState("");
  const [grievance, setGrievance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Selected ticket for details modal
  const [viewTicket, setViewTicket] = useState<PrioritySupportTicket | null>(null);

  // Fetch tickets and ignore responses from superseded requests.
  useEffect(() => {
    if (!hasPrioritySupport) return;
    const controller = new AbortController();
    dashboardRequest<{ tickets: PrioritySupportTicket[] }>(
      "/api/priority-support",
      { signal: controller.signal },
    )
      .then((res) => {
        if (!controller.signal.aborted) setTickets(res.tickets || []);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setTicketsError(err instanceof Error ? err.message : "Unable to load priority support tickets.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTickets(false);
      });
    return () => controller.abort();
  }, [hasPrioritySupport, refreshIndex]);

  // Load API keys when opening modal
  useEffect(() => {
    if (!modalOpen) return;
    async function loadKeys() {
      setLoadingKeys(true);
      try {
        const res = await dashboardRequest<{ keys: ApiKeyRecord[] }>("/api/auth/keys");
        const list = (res.keys || []).filter((k) => k.is_active);
        setApiKeys(list);
        if (list.length > 0 && !selectedKeyId) {
          setSelectedKeyId(list[0].id);
        }
      } catch {
        // Fallback demo key if API keys fail
        if (demo) {
          setApiKeys([
            {
              id: "demo-key-1",
              name: "Production Key",
              key_hint: "gk_live_demo",
              calls_count: 10,
              generations_count: 5,
              created_at: new Date().toISOString(),
              is_active: true,
              type: "image_gen",
            },
          ]);
          setSelectedKeyId("demo-key-1");
        }
      } finally {
        setLoadingKeys(false);
      }
    }
    void loadKeys();
  }, [modalOpen, demo, selectedKeyId]);

  // Load Generations for selected key and time window
  useEffect(() => {
    if (!modalOpen || !selectedKeyId) return;

    const controller = new AbortController();
    async function loadGenerations() {
      setLoadingGenerations(true);
      setSelectedGenerationId("");
      try {
        const sinceDate =
          timeWindowHours > 0
            ? new Date(Date.now() - timeWindowHours * 3600 * 1000).toISOString()
            : undefined;
        const params = new URLSearchParams({
          api_key_id: selectedKeyId,
          limit: "50",
          ...(sinceDate ? { since: sinceDate } : {}),
        });
        const res = await dashboardRequest<{ generations: GenerationOption[] }>(
          `/api/generations?${params.toString()}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const list = res.generations || [];
        setGenerations(list);
        if (list.length > 0) {
          setSelectedGenerationId(list[0].id);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGenerations([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingGenerations(false);
        }
      }
    }

    void loadGenerations();
    return () => controller.abort();
  }, [modalOpen, selectedKeyId, timeWindowHours]);

  function resetForm() {
    setGenerations([]);
    setGrievance("");
    setSelectedGenerationId("");
    setSubmitError(null);
  }

  async function handleCreateTicket(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedKeyId) {
      setSubmitError("Please select an API key.");
      return;
    }
    if (!selectedGenerationId) {
      setSubmitError("Please select a generation.");
      return;
    }
    if (!grievance.trim()) {
      setSubmitError("Please provide a grievance or issue description.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const created = await dashboardRequest<PrioritySupportTicket>("/api/priority-support", jsonRequest(
        {
          api_key_id: selectedKeyId,
          generation_id: selectedGenerationId,
          greivience: grievance.trim(),
        },
        { method: "POST" },
      ));

      setTickets((prev) => [created, ...prev]);
      setSuccessNotice(`Ticket #${created.id.slice(0, 8)} successfully submitted to engineering.`);
      setModalOpen(false);
      resetForm();
      setTimeout(() => setSuccessNotice(null), 6000);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit priority support ticket."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Non-priority plan view
  if (!hasPrioritySupport) {
    return (
      <div className="generation-page">
        <PageHeader
          title="Priority Support"
          eyebrow="Enterprise Feature"
          description="Direct priority engineering escalation for your mission-critical AI generations."
        />
        <div className="panel" style={{ padding: "2.5rem 2rem", maxWidth: 680, margin: "2rem auto", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(124, 58, 237, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", color: "#a78bfa" }}>
            <SupportIcon width={28} height={28} />
          </div>
          <h2 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Enterprise Priority Support</h2>
          <p style={{ color: "var(--text-secondary, #94a3b8)", lineHeight: 1.6, marginBottom: "1.75rem" }}>
            Priority Support connects your engineering team directly with our core runtime engineers.
            Submit tickets linked to specific generation outputs, debug failed jobs with deep telemetry, and receive expedited SLA turnaround.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link className="button button-primary" href="/subscription">
              Upgrade to Enterprise
            </Link>
            <Link className="button button-secondary" href="/resources">
              Read documentation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="generation-page">
      <PageHeader
        title="Priority Support"
        eyebrow="Enterprise Tier"
        description="Direct priority engineering assistance. Inspect ticket progress or raise a new issue linked to your API credentials and generations."
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="button button-secondary"
              onClick={() => {
                clearRequestCache();
                setLoadingTickets(true);
                setTicketsError(null);
                setRefreshIndex((n) => n + 1);
              }}
              type="button"
            >
              <RefreshIcon width={16} height={16} />
              <span>Refresh</span>
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              type="button"
            >
              <PlusIcon width={16} height={16} />
              <span>Raise new ticket</span>
            </button>
          </div>
        }
      />

      {successNotice ? (
        <div className="inline-notice inline-notice--success" style={{ marginBottom: "1.5rem" }}>
          <CheckIcon width={18} height={18} />
          <span>{successNotice}</span>
        </div>
      ) : null}

      {ticketsError ? (
        <div className="inline-notice inline-notice--warning" style={{ marginBottom: "1.5rem" }}>
          <WarningIcon width={18} height={18} />
          <span>{ticketsError}</span>
        </div>
      ) : null}

      {/* Ticket History Table */}
      <section aria-labelledby="ticket-history-heading" className="panel">
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
          <h2 id="ticket-history-heading" style={{ fontSize: "1.1rem", margin: 0 }}>
            Ticket History
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)" }}>
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          </span>
        </div>

        {loadingTickets ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>
            Loading tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--text-secondary, #94a3b8)" }}>
              <SupportIcon width={22} height={22} />
            </div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>No support tickets raised yet</h3>
            <p style={{ color: "var(--text-secondary, #94a3b8)", maxWidth: 420, margin: "0 auto 1.25rem", fontSize: "0.9rem" }}>
              If you experience unexpected behavior or latency with any generation, raise a priority ticket to notify our engineering team.
            </p>
            <button
              className="button button-primary"
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              type="button"
            >
              <PlusIcon width={16} height={16} />
              <span>Raise your first ticket</span>
            </button>
          </div>
        ) : (
          <div className="data-table-scroll" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Product</th>
                  <th>Generation</th>
                  <th>Grievance</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const isOpen = ticket.status === "open";
                  return (
                    <tr key={ticket.id}>
                      <td>
                        <code className="identifier-cell">#{ticket.id.slice(0, 8)}</code>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            isOpen ? "status-badge--violet" : "status-badge--success"
                          }`}
                        >
                          {isOpen ? "Open" : "Resolved"}
                        </span>
                      </td>
                      <td>
                        <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
                          {ticket.product_name || ticket.product_code || "—"}
                        </span>
                      </td>
                      <td>
                        {ticket.generation_id ? (
                          <Link
                            className="table-link"
                            href={`/generations/${ticket.generation_id}`}
                            style={{ color: "#a78bfa", textDecoration: "none" }}
                            title="View generation output"
                          >
                            <code className="identifier-cell">{ticket.generation_id.slice(0, 8)}…</code>
                          </Link>
                        ) : (
                          <span style={{ color: "var(--text-secondary, #94a3b8)" }}>—</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ticket.description || ticket.greivience || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", whiteSpace: "nowrap" }}>
                        {formatDate(ticket.created_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="button button-secondary"
                          onClick={() => setViewTicket(ticket)}
                          style={{ padding: "0.25rem 0.65rem", fontSize: "0.8rem" }}
                          type="button"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* New Ticket Modal */}
      {modalOpen ? (
        <div aria-labelledby="new-ticket-title" aria-modal="true" className="modal-layer" role="dialog">
          <button
            aria-label="Close new ticket dialog"
            className="modal-backdrop"
            onClick={() => !submitting && setModalOpen(false)}
            type="button"
          />
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-heading">
              <span className="modal-icon">
                <SupportIcon />
              </span>
              <div>
                <p className="panel-kicker">Priority Escalation</p>
                <h2 id="new-ticket-title">Raise Priority Ticket</h2>
              </div>
            </div>

            {submitError ? (
              <div className="inline-notice inline-notice--warning" style={{ marginBottom: "1rem" }}>
                <WarningIcon width={16} height={16} />
                <span>{submitError}</span>
              </div>
            ) : null}

            <form onSubmit={handleCreateTicket}>
              {/* Step 1: Select API Key */}
              <label className="field-label" htmlFor="ticket-api-key">
                1. Select API Key
              </label>
              {loadingKeys ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Loading API keys…</p>
              ) : apiKeys.length === 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.85rem", color: "#f87171" }}>No active API keys found.</p>
                  <Link href="/api-keys" style={{ fontSize: "0.85rem", color: "#a78bfa" }}>
                    Create an API key first <ArrowRightIcon size={14} />
                  </Link>
                </div>
              ) : (
                <select
                  id="ticket-api-key"
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  style={{ marginBottom: "1rem", width: "100%" }}
                  value={selectedKeyId}
                >
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.key_hint || key.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              )}

              {/* Step 2: Time window filter */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <label className="field-label" htmlFor="ticket-time-window" style={{ marginBottom: 0 }}>
                  2. Filter Window
                </label>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)" }}>
                  Sorted descending
                </span>
              </div>
              <select
                id="ticket-time-window"
                onChange={(e) => setTimeWindowHours(Number(e.target.value))}
                style={{ marginBottom: "1rem", width: "100%" }}
                value={timeWindowHours}
              >
                {TIME_WINDOWS.map((w) => (
                  <option key={w.hours} value={w.hours}>
                    {w.label}
                  </option>
                ))}
              </select>

              {/* Step 3: Select Generation */}
              <label className="field-label" htmlFor="ticket-generation">
                3. Problematic Generation
              </label>
              {loadingGenerations ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Searching generations from key…
                </p>
              ) : generations.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", fontStyle: "italic" }}>
                  No generations found for this API key within the selected window.
                </p>
              ) : (
                <select
                  id="ticket-generation"
                  onChange={(e) => setSelectedGenerationId(e.target.value)}
                  style={{ marginBottom: "1rem", width: "100%" }}
                  value={selectedGenerationId}
                >
                  {generations.map((gen) => {
                    const prompt =
                      gen.title ||
                      (gen.input_payload?.prompt as string) ||
                      (gen.input_payload?.text as string) ||
                      gen.id;
                    const dateStr = formatDate(gen.created_at);
                    return (
                      <option key={gen.id} value={gen.id}>
                        [{gen.product_code || "gen"}] {truncate(String(prompt), 45)} ({dateStr})
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Step 4: Grievance description */}
              <label className="field-label" htmlFor="ticket-grievance">
                4. Grievance Description
              </label>
              <textarea
                id="ticket-grievance"
                onChange={(e) => setGrievance(e.target.value)}
                placeholder="Describe the issue, defect, unexpected artifact, or error you experienced with this generation…"
                rows={4}
                style={{
                  width: "100%",
                  marginBottom: "1.25rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  background: "var(--surface-input, rgba(255,255,255,0.05))",
                  border: "1px solid var(--border, rgba(255,255,255,0.12))",
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  resize: "vertical",
                }}
                value={grievance}
              />

              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={
                    submitting ||
                    !selectedKeyId ||
                    !selectedGenerationId ||
                    !grievance.trim()
                  }
                  type="submit"
                >
                  {submitting ? "Submitting ticket…" : "Send ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Ticket Detail Modal */}
      {viewTicket ? (
        <div aria-labelledby="view-ticket-title" aria-modal="true" className="modal-layer" role="dialog">
          <button
            aria-label="Close ticket detail dialog"
            className="modal-backdrop"
            onClick={() => setViewTicket(null)}
            type="button"
          />
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-heading">
              <span className="modal-icon">
                <SupportIcon />
              </span>
              <div>
                <p className="panel-kicker">Ticket Details</p>
                <h2 id="view-ticket-title">#{viewTicket.id.slice(0, 8)}</h2>
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.85rem", fontSize: "0.9rem", margin: "1rem 0 1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary, #94a3b8)" }}>Status:</span>
                <span
                  className={`status-badge ${
                    viewTicket.status === "open" ? "status-badge--violet" : "status-badge--success"
                  }`}
                >
                  {viewTicket.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary, #94a3b8)" }}>Product:</span>
                <strong>{viewTicket.product_name || viewTicket.product_code || "—"}</strong>
              </div>

              {viewTicket.generation_id ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary, #94a3b8)" }}>Generation:</span>
                  <Link
                    className="button button-secondary"
                    href={`/generations/${viewTicket.generation_id}`}
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    <PlaygroundIcon width={14} height={14} />
                    <span>View generation output</span>
                  </Link>
                </div>
              ) : null}

              {viewTicket.api_key_hint || viewTicket.api_key_name ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary, #94a3b8)" }}>API Key:</span>
                  <span>{viewTicket.api_key_name ? `${viewTicket.api_key_name} (${viewTicket.api_key_hint || ""})` : viewTicket.api_key_hint}</span>
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary, #94a3b8)" }}>Created:</span>
                <span>{formatDate(viewTicket.created_at)}</span>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: "0.35rem" }}>
                  Grievance Description:
                </span>
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {viewTicket.description || viewTicket.greivience}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setViewTicket(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
