"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ImageIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
  VideoIcon,
  VoiceIcon,
  WarningIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";
import { canUseProduct, keyMatchesProduct } from "@/lib/access";
import { DEMO_KEYS } from "@/lib/demo-data";
import type { ApiKeyRecord, ApiKeyType, DashboardUser } from "@/lib/types";

type KeysResponse = { keys?: ApiKeyRecord[] };

const SERVICES: Array<{
  color: string;
  description: string;
  icon: typeof ImageIcon;
  label: string;
  prefix: string;
  type: ApiKeyType;
}> = [
  {
    color: "violet",
    description: "Text-to-image and image workflows",
    icon: ImageIcon,
    label: "Image generation",
    prefix: "img_live_",
    type: "image_gen",
  },
  {
    color: "blue",
    description: "Preset and cloned voice synthesis",
    icon: VoiceIcon,
    label: "Text to speech",
    prefix: "tts_live_",
    type: "tts",
  },
  {
    color: "green",
    description: "Creator video with optional audio",
    icon: VideoIcon,
    label: "Video generation",
    prefix: "vid_live_",
    type: "video",
  },
];

SERVICES.push({ color: "violet", description: "Edit images using reference inputs", icon: ImageIcon,
  label: "Image to image", prefix: "", type: "image2image" });
SERVICES.push({ color: "blue", description: "Keys with no current product access", icon: KeyIcon,
  label: "Other keys", prefix: "", type: "unknown" });

const numberFormatter = new Intl.NumberFormat("en-US");

function formatDate(value?: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function canCreateKeys(user: DashboardUser): boolean {
  return SERVICES.some((service) => canUseProduct(user, service.type === "image_gen" ? "image" : service.type));
}

function canCreateKeyType(user: DashboardUser, _keys: ApiKeyRecord[], type: ApiKeyType): boolean {
  return canUseProduct(user, type === "image_gen" ? "image" : type);
}

function normalizeKey(key: ApiKeyRecord): ApiKeyRecord {
  return {
    ...key,
    calls_count: key.calls_count || 0,
    generations_count: key.generations_count || 0,
    is_active: key.is_active !== false,
  };
}

export function ApiKeysManager({ demo, user }: { demo: boolean; user: DashboardUser }) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(demo ? DEMO_KEYS : []);
  const [expandedService, setExpandedService] = useState<ApiKeyType | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ApiKeyType>("image_gen");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{ name: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const createDialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    dashboardRequest<KeysResponse>("/api/auth/keys", { signal: controller.signal })
      .then((payload) => setKeys((payload.keys || []).map(normalizeKey)))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "API keys could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demo]);

  useEffect(() => {
    if (!formOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = createDialog.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFormOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus();
    };
  }, [formOpen]);

  const totals = useMemo(() => ({
    calls: keys.reduce((sum, key) => sum + key.calls_count, 0),
    generations: keys.reduce((sum, key) => sum + key.generations_count, 0),
  }), [keys]);
  const firstAvailableType = SERVICES.find((service) => canCreateKeyType(user, keys, service.type))?.type;

  function openCreateForm(preferredType?: ApiKeyType) {
    const nextType = preferredType && canCreateKeyType(user, keys, preferredType)
      ? preferredType
      : firstAvailableType;
    if (!nextType) return;
    setType(nextType);
    setFormOpen(true);
  }

  async function createKey() {
    if (!canCreateKeyType(user, keys, type) || creating) return;
    setCreating(true);
    setError("");
    const service = SERVICES.find((item) => item.type === type) ?? SERVICES[0];
    const cleanName = name.trim() || `${service.label} key`;
    try {
      let created: ApiKeyRecord;
      if (demo) {
        const secret = `${service.prefix}${crypto.randomUUID().replaceAll("-", "")}`;
        created = {
          calls_count: 0,
          created_at: new Date().toISOString(),
          full_key: secret,
          generations_count: 0,
          id: crypto.randomUUID(),
          is_active: true,
          key_hint: secret.slice(-4),
          last_used_at: null,
          name: cleanName,
          type,
        };
      } else {
        created = await dashboardRequest<ApiKeyRecord>(
          "/api/auth/keys",
          jsonRequest({ name: cleanName, type }, { method: "POST" }),
        );
      }
      const { full_key: secret, ...safeCreated } = created;
      const normalized = normalizeKey(safeCreated as ApiKeyRecord);
      setKeys((current) => [normalized, ...current]);
      setExpandedService(type);
      if (secret) setCreatedSecret({ name: cleanName, value: secret });
      setName("");
      setFormOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The API key could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    setError("");
    try {
      if (!demo) await dashboardRequest<{ ok: boolean }>(`/api/auth/keys/${id}`, { method: "DELETE" });
      setKeys((current) => current.filter((key) => key.id !== id));
      setConfirmDelete(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The API key could not be deleted.");
    } finally {
      setDeleting(null);
    }
  }

  async function copySecret() {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <PageHeader
        actions={
          <button
            className="button button-primary"
            disabled={!firstAvailableType}
            onClick={() => openCreateForm()}
            type="button"
          >
            <PlusIcon /> Create key
          </button>
        }
        description="Create separate credentials for each application and service. Secrets are shown once."
        eyebrow="Developer credentials"
        title="API keys"
      />

      {!canCreateKeys(user) ? (
        <div className="inline-notice inline-notice--warning">
          <WarningIcon /> Start a trial or choose a paid plan before creating API keys.
        </div>
      ) : null}
      {error ? <div className="inline-notice inline-notice--danger" role="alert"><WarningIcon /> {error}</div> : null}

      {createdSecret ? (
        <section className="secret-reveal" aria-labelledby="new-key-title">
          <div className="secret-reveal-heading">
            <span><CheckIcon /></span>
            <div>
              <h2 id="new-key-title">{createdSecret.name} is ready</h2>
              <p>Copy this secret now. For your security, Gathos cannot show it again.</p>
            </div>
          </div>
          <div className="secret-value-row">
            <code>{createdSecret.value}</code>
            <button className="button button-dark" onClick={copySecret} type="button">
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <button className="text-button" onClick={() => setCreatedSecret(null)} type="button">I saved it</button>
        </section>
      ) : null}

      <section aria-label="Credential summary" className="compact-metric-strip">
        <div><span>Active keys</span><strong>{keys.filter((key) => key.is_active).length}</strong></div>
        <div><span>Lifetime calls</span><strong>{numberFormatter.format(totals.calls)}</strong></div>
        <div><span>Generations</span><strong>{numberFormatter.format(totals.generations)}</strong></div>
        <div><span>Services</span><strong>{new Set(keys.map((key) => key.type)).size}</strong></div>
      </section>

      {loading ? (
        <div className="key-service-accordion" aria-busy="true" aria-label="Loading API keys">
          {SERVICES.map((service) => <div className="skeleton skeleton-service-accordion" key={service.type} />)}
        </div>
      ) : (
        <div className="key-service-accordion">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            const serviceKeys = keys.filter((key) => service.type === "unknown"
              ? !(key.product_codes?.length) && key.type === "unknown"
              : keyMatchesProduct(key, service.type === "image_gen" ? "image" : service.type));
            if (service.type === "unknown" && !serviceKeys.length) return null;
            return (
              <section className="panel key-service-item" key={service.type}>
                <h2 className="key-service-title">
                  <button
                    aria-controls={`key-service-panel-${service.type}`}
                    aria-expanded={expandedService === service.type}
                    className="key-service-heading"
                    id={`key-service-trigger-${service.type}`}
                    onClick={() => setExpandedService((current) => current === service.type ? null : service.type)}
                    type="button"
                  >
                    <span className={`service-icon service-icon--${service.color}`}><Icon /></span>
                    <span className="key-service-copy">
                      <span className="key-service-label">{service.label}</span>
                      <span className="key-service-description">{service.description}</span>
                    </span>
                    <span className="count-badge" aria-label={`${serviceKeys.length} keys`}>{serviceKeys.length}</span>
                    <ChevronDownIcon className="key-service-chevron" />
                  </button>
                </h2>
                <div
                  aria-labelledby={`key-service-trigger-${service.type}`}
                  className="key-list"
                  hidden={expandedService !== service.type}
                  id={`key-service-panel-${service.type}`}
                  role="region"
                >
                  {serviceKeys.length ? serviceKeys.map((apiKey) => (
                    <article className="key-row" key={apiKey.id}>
                      <div className="key-row-main">
                        <span className="key-row-icon"><KeyIcon /></span>
                        <div>
                          <div className="key-name-line">
                            <strong>{apiKey.name}</strong>
                            <span className={apiKey.is_active ? "status-badge status-badge--success" : "status-badge"}>
                              {apiKey.is_active ? "Active" : "Revoked"}
                            </span>
                          </div>
                          <code>{apiKey.key_hint}••••</code>
                        </div>
                        {confirmDelete === apiKey.id ? (
                          <div className="delete-actions">
                            <button className="text-button" onClick={() => setConfirmDelete(null)} type="button">Cancel</button>
                            <button
                              className="button button-danger button-small"
                              disabled={deleting === apiKey.id}
                              onClick={() => deleteKey(apiKey.id)}
                              type="button"
                            >
                              {deleting === apiKey.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        ) : (
                          <button
                            aria-label={`Delete ${apiKey.name}`}
                            className="icon-button key-delete-button"
                            onClick={() => setConfirmDelete(apiKey.id)}
                            type="button"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                      <div className="key-row-meta">
                        <span><strong>{numberFormatter.format(apiKey.generations_count)}</strong> generations</span>
                        <span><strong>{numberFormatter.format(apiKey.calls_count)}</strong> calls</span>
                        <span>Last used <strong>{formatDate(apiKey.last_used_at)}</strong></span>
                      </div>
                    </article>
                  )) : (
                    <div className="service-empty">
                      <span className={`service-icon service-icon--${service.color}`}><KeyIcon /></span>
                      <p>No {service.label.toLowerCase()} keys yet.</p>
                      {canCreateKeyType(user, keys, service.type) ? (
                        <button className="text-button" onClick={() => openCreateForm(service.type)} type="button">
                          Create your first key
                        </button>
                      ) : <small>{service.type === "video" ? "Creator plan required" : "Plan access required"}</small>}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {formOpen ? (
        <div aria-labelledby="create-key-title" aria-modal="true" className="modal-layer" role="dialog">
          <button aria-label="Close create key dialog" className="modal-backdrop" onClick={() => setFormOpen(false)} type="button" />
          <div className="modal-card" ref={createDialog}>
            <div className="modal-heading">
              <span className="modal-icon"><KeyIcon /></span>
              <div><p className="panel-kicker">New credential</p><h2 id="create-key-title">Create an API key</h2></div>
            </div>
            <label className="field-label" htmlFor="key-service">Service</label>
            <select id="key-service" onChange={(event) => setType(event.target.value as ApiKeyType)} value={type}>
              {SERVICES.filter((service) => service.type !== "unknown").map((service) => (
                <option disabled={!canCreateKeyType(user, keys, service.type)} key={service.type} value={service.type}>
                  {service.label}
                  {!canUseProduct(user, service.type === "image_gen" ? "image" : service.type)
                    ? " — Not available on this plan"
                    : ""}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="key-name">Key name</label>
            <input
              autoComplete="off"
              id="key-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Production website"
              type="text"
              value={name}
            />
            <p className="field-help">Use a name that identifies the app or environment using this key.</p>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setFormOpen(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={creating || !canCreateKeyType(user, keys, type)} onClick={createKey} type="button">
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
