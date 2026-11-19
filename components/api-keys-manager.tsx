"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/icons";
import { useDashboardAccount } from "@/components/dashboard-account";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest, jsonRequest } from "@/lib/client-api";
import { keyMatchesProduct } from "@/lib/access";
import { keyProducts, canCreateProductKey } from "@/lib/products";
import { DEMO_KEYS } from "@/lib/demo-data";
import type { ApiKeyRecord, ApiKeyType, DashboardUser } from "@/lib/types";

type KeysResponse = { keys?: ApiKeyRecord[] };

const DEMO_PRODUCT_TAGS = new Map([
  ["image", "t2i"],
  ["image2image", "i2i"],
  ["video", "t2v"],
  ["tts", "tts"],
  ["stt", "stt"],
]);

const numberFormatter = new Intl.NumberFormat("en-US");

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function ApiKeyWalkthrough({ userId }: { userId: string }) {
  const storageKey = `gathos:api-key-walkthrough:v1:${userId}`;
  const [dismissed, setDismissed] = useState(false);
  const showWalkthrough = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return window.localStorage.getItem(storageKey) !== "dismissed";
      } catch {
        return true;
      }
    },
    () => false,
  );

  if (dismissed || !showWalkthrough) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "dismissed");
    } catch {
      // The panel still closes when browser storage is unavailable.
    }
  }

  return (
    <section className="panel api-key-walkthrough" aria-labelledby="api-key-walkthrough-title">
      <h2 id="api-key-walkthrough-title">What’s new with API keys</h2>
      <ol>
        <li><strong>Recognize the product from its prefix.</strong> For example, <code>gth-t2i-</code> marks a text-to-image key.</li>
        <li><strong>Find and reveal a new key.</strong> Use search and status filters to find it, then select the eye icon to view or copy it while it’s active.</li>
        <li><strong>Keep using your existing keys.</strong> If you need to view an older key you no longer have, create a replacement, update your app, then revoke the old key.</li>
      </ol>
      <button className="button button-secondary button-small" onClick={dismiss} type="button">Got it</button>
    </section>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function normalizeKey(key: ApiKeyRecord): ApiKeyRecord {
  return {
    ...key,
    calls_count: key.calls_count || 0,
    generations_count: key.generations_count || 0,
    is_active: key.is_active !== false,
  };
}

export function ApiKeysManager({ demo, user: initialUser, initialKeys }: { demo: boolean; user: DashboardUser; initialKeys?: ApiKeyRecord[] }) {
  const { user: account, refresh } = useDashboardAccount(initialUser);
  const user = account.products ? account : initialUser;
  const [keys, setKeys] = useState<ApiKeyRecord[]>(demo ? DEMO_KEYS : (initialKeys ?? []));
  const [loading, setLoading] = useState(!demo && initialKeys === undefined);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ApiKeyType>("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{ name: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const demoSecrets = useRef(new Map<string, string>());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const createDialog = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!demo) void refresh(); }, [demo, refresh]);

  useEffect(() => {
    if (!createdSecret) return;
    const timer = window.setTimeout(() => setCreatedSecret(null), 60_000);
    const hideWhenAway = () => { if (document.hidden) setCreatedSecret(null); };
    document.addEventListener("visibilitychange", hideWhenAway);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", hideWhenAway); };
  }, [createdSecret]);

  useEffect(() => {
    if (demo || initialKeys !== undefined) return;
    const controller = new AbortController();
    dashboardRequest<KeysResponse>("/api/auth/keys", { signal: controller.signal })
      .then((payload) => setKeys((payload.keys || []).map(normalizeKey)))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "API keys could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demo, initialKeys]);

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
  const SERVICES = useMemo(() => {
    return keyProducts(user, keys).map((product) => ({
      type: product.code, label: product.name, color: "green", icon: KeyIcon,
      description: "Application credentials", available: product.available !== false,
    })).concat([{ type: "unknown", label: "Other keys", color: "blue", icon: KeyIcon,
      description: "Keys with no current product access", available: false }]);
  }, [user, keys]);
  const filteredKeys = keys.filter((key) => {
    const matchesProduct = !productFilter || (productFilter === "unknown"
      ? key.type === "unknown"
      : keyMatchesProduct(key, productFilter));
    const matchesStatus = status === "all" || (status === "active" ? key.is_active : !key.is_active);
    const matchesSearch = `${key.name} ${key.key_hint}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesProduct && matchesStatus && matchesSearch;
  });
  const firstAvailableType = SERVICES.find((service) => service.available && canCreateProductKey(user, service.type))?.type;

  function openCreateForm(preferredType?: ApiKeyType) {
    const nextType = preferredType && canCreateProductKey(user, preferredType)
      ? preferredType
      : firstAvailableType;
    if (!nextType) return;
    setType(nextType);
    setFormOpen(true);
  }

  async function createKey() {
    if (!canCreateProductKey(user, type) || creating) return;
    setCreating(true);
    setError("");
    const service = SERVICES.find((item) => item.type === type) ?? SERVICES[0];
    const cleanName = name.trim() || `${service.label} key`;
    try {
      let created: ApiKeyRecord;
      if (demo) {
        const bytes = crypto.getRandomValues(new Uint8Array(25));
        const token = btoa(String.fromCharCode(...bytes)).slice(0, 33).replaceAll("+", "-").replaceAll("/", "_");
        const tag = DEMO_PRODUCT_TAGS.get(type);
        if (!tag) throw new Error("This product is unavailable in the demo.");
        const prefix = `gth-${tag}-`;
        const secret = prefix + token;
        created = {
          calls_count: 0,
          created_at: new Date().toISOString(),
          full_key: secret,
          generations_count: 0,
          id: crypto.randomUUID(),
          is_active: true,
          key_hint: `${prefix}...${secret.slice(-4)}`,
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
      const normalized = normalizeKey({ ...safeCreated, can_reveal: true } as ApiKeyRecord);
      if (demo && secret) demoSecrets.current.set(normalized.id, secret);
      setKeys((current) => [normalized, ...current]);
      setSearch("");
      setStatus("all");
      setProductFilter("");
      if (secret) setCreatedSecret({ name: cleanName, value: secret });
      setName("");
      setFormOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The API key could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function revealKey(key: ApiKeyRecord) {
    setRevealing(key.id);
    setError("");
    try {
      const response = demo
        ? { full_key: demoSecrets.current.get(key.id) }
        : await dashboardRequest<{ full_key: string }>(`/api/auth/keys/${key.id}/reveal`, { method: "POST", cache: "no-store" });
      if (!response.full_key) throw new Error("This older key cannot be revealed. Create a replacement key.");
      setCopied(false);
      setCreatedSecret({ name: key.name, value: response.full_key });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The API key could not be revealed.");
    } finally {
      setRevealing(null);
    }
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    setError("");
    try {
      if (!demo) await dashboardRequest<{ ok: boolean }>(`/api/auth/keys/${id}`, { method: "DELETE" });
      setKeys((current) => current.filter((key) => key.id !== id));
      setCreatedSecret(null);
      demoSecrets.current.delete(id);
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
        description="Create separate credentials for each application and service. View and copy active keys when you need them."
        eyebrow="Developer credentials"
        title="API keys"
      />

      {!demo && user.userId ? <ApiKeyWalkthrough key={user.userId} userId={user.userId} /> : null}

      {!(user.product_codes ?? []).some((code) => canCreateProductKey(user, code)) ? (
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
              <h2 id="new-key-title">{createdSecret.name}</h2>
              <p>Keep this key private. You can reveal it again while it is active.</p>
            </div>
          </div>
          <div className="secret-value-row">
            <code>{createdSecret.value}</code>
            <button className="button button-dark" onClick={copySecret} type="button">
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <button className="text-button" onClick={() => setCreatedSecret(null)} type="button">Hide key</button>
        </section>
      ) : null}

      <section aria-label="Credential summary" className="compact-metric-strip">
        <div><span>Active keys</span><strong>{keys.filter((key) => key.is_active).length}</strong></div>
        <div><span>Lifetime calls</span><strong>{numberFormatter.format(totals.calls)}</strong></div>
        <div><span>Generations</span><strong>{numberFormatter.format(totals.generations)}</strong></div>
        <div><span>Services</span><strong>{new Set(keys.map((key) => key.type)).size}</strong></div>
      </section>

      <div className="key-filters api-key-filters">
        <label>Search keys<input type="search" placeholder="Name or key prefix" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Product<select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
          <option value="">All products</option>
          {SERVICES.map((service) => <option key={service.type} value={service.type}>{service.label}</option>)}
        </select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All keys</option><option value="active">Active</option><option value="revoked">Revoked</option>
        </select></label>
      </div>

      <section className="panel api-key-table-panel" aria-label="API keys" aria-busy={loading}>
        <div className="api-key-table-heading">
          <h2>All keys</h2>
          <span role="status">{loading ? "Loading keys…" : `${filteredKeys.length} of ${keys.length} keys`}</span>
        </div>
        <div className="table-scroll" role="region" aria-label="API keys table" tabIndex={0}>
          <table className="data-table api-key-table">
            <thead>
              <tr>
                {["Key", "Product", "Status", "Usage", "Created", "Last used", "Actions"].map((label) => (
                  <th scope="col" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="api-key-table-empty">Loading API keys…</div></td></tr>
              ) : filteredKeys.length ? filteredKeys.map((apiKey) => {
                const service = SERVICES.find((item) => keyMatchesProduct(apiKey, item.type));
                return (
                  <tr key={apiKey.id}>
                    <th scope="row" className="api-key-name">
                      <strong>{apiKey.name}</strong>
                      <code>{apiKey.key_hint}</code>
                    </th>
                    <td>{apiKey.product_name || service?.label || apiKey.type}</td>
                    <td><span className={apiKey.is_active ? "status-badge status-badge--success" : "status-badge"}>
                      {apiKey.is_active ? "Active" : "Revoked"}
                    </span></td>
                    <td className="api-key-usage">
                      <span>{numberFormatter.format(apiKey.calls_count)} calls</span>
                      <span>{numberFormatter.format(apiKey.generations_count)} generations</span>
                    </td>
                    <td className="api-key-date">{formatDate(apiKey.created_at)}</td>
                    <td className="api-key-date">{formatDate(apiKey.last_used_at)}</td>
                    <td>
                      <div className="api-key-actions">
                        {apiKey.is_active ? <button
                          className="icon-button api-key-reveal-button"
                          disabled={!apiKey.can_reveal || revealing === apiKey.id}
                          aria-busy={revealing === apiKey.id}
                          title={apiKey.can_reveal ? `View ${apiKey.name}` : "Older keys need replacement before they can be viewed"}
                          aria-label={apiKey.can_reveal ? `Reveal ${apiKey.name}` : `Replace ${apiKey.name} to reveal`}
                          onClick={() => revealKey(apiKey)} type="button"
                        ><EyeIcon /></button> : null}
                        {apiKey.is_active && (confirmDelete === apiKey.id ? (
                          <div className="delete-actions">
                            <button className="text-button" onClick={() => setConfirmDelete(null)} type="button">Cancel</button>
                            <button
                              className="button button-danger button-small"
                              disabled={deleting === apiKey.id}
                              onClick={() => deleteKey(apiKey.id)}
                              aria-label={`Confirm revoke ${apiKey.name}`}
                              type="button"
                            >{deleting === apiKey.id ? "Revoking…" : "Revoke"}</button>
                          </div>
                        ) : (
                          <button
                            aria-label={`Revoke ${apiKey.name}`}
                            title="Revoke key"
                            className="icon-button key-delete-button"
                            onClick={() => setConfirmDelete(apiKey.id)}
                            type="button"
                          ><TrashIcon /></button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7}>
                  <div className="api-key-table-empty">
                    <KeyIcon />
                    <strong>{keys.length ? "No keys match your filters" : "Create your first API key"}</strong>
                    <p>{keys.length ? "Try a different search, product, or status." : "Create a key to connect an application to a product."}</p>
                    {keys.length ? (
                      <button className="text-button" onClick={() => { setSearch(""); setStatus("all"); setProductFilter(""); }} type="button">Clear filters</button>
                    ) : firstAvailableType ? (
                      <button className="button button-primary button-small" onClick={() => openCreateForm()} type="button">Create key</button>
                    ) : null}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
              {SERVICES.filter((service) => service.available).map((service) => (
                <option disabled={!canCreateProductKey(user, service.type)} key={service.type} value={service.type}>
                  {service.label}
                  {!canCreateProductKey(user, service.type)
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
              <button className="button button-primary" disabled={creating || !canCreateProductKey(user, type)} onClick={createKey} type="button">
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
