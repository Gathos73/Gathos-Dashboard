"use client";

import { useEffect, useMemo, useState } from "react";

import { AnalyticsIcon, KeyIcon, RefreshIcon, SparklesIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import { createDemoUsage } from "@/lib/demo-data";
import type { UsageApiPayload, UsagePayload, UsagePoint, UsageRange } from "@/lib/types";

const RANGES: Array<{ value: UsageRange; label: string }> = [
  { value: "current_window", label: "Current window" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];
const SERVICES = ["image", "image2image", "tts", "video"] as const;
type ServiceFilter = "all" | (typeof SERVICES)[number];
const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric", hour: "numeric", minute: "2-digit", month: "short",
  }).format(new Date(value));
}

function formatBucket(value: string, minutes: number): string {
  return new Intl.DateTimeFormat("en-US", {
    ...(minutes >= 360 ? { month: "short", day: "numeric" } as const : {}),
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function serviceLabel(value?: string): string {
  if (value === "tts") return "Text to speech";
  if (value === "video") return "Video";
  if (value === "image2image") return "Image to image";
  return "Text to image";
}

function normalizeUsage(payload: UsageApiPayload): UsagePayload {
  const total = payload.summary.requests;
  const services = (["image", "image2image", "tts", "video"] as const).map((type) => ({
    count: payload.by_type[type] ?? 0,
    percentage: total ? Math.round(((payload.by_type[type] ?? 0) / total) * 100) : 0,
    type,
  }));
  return {
    limits: payload.limits,
    bucket_minutes: payload.period.bucket_minutes,
    sampled_at: payload.period.sampled_at,
    active_keys: payload.summary.active_keys,
    average_per_day: Number((total / payload.period.days).toFixed(1)),
    days: payload.period.days,
    period_end: payload.period.end,
    period_start: payload.period.start,
    recent_activity: payload.recent.map((activity, index) => ({
      created_at: activity.created_at,
      id: `${activity.created_at}-${activity.api_key?.id || "session"}-${index}`,
      key_name: activity.api_key?.name,
      type: activity.type,
    })),
    series: payload.daily,
    services,
    top_keys: payload.keys
      .filter((key) => key.type !== "unknown")
      .toSorted((a, b) => b.requests - a.requests)
      .slice(0, 5)
      .map((key) => ({
        count: key.requests,
        id: key.id,
        name: key.name,
        type: key.type,
    })),
    total_requests: total,
    truncated: payload.truncated,
  };
}

function UsageChart({ series, service, bucketMinutes, sampledAt }: {
  series: UsagePoint[]; service: ServiceFilter; bucketMinutes: number; sampledAt: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const available = series.filter((point) => new Date(point.date).getTime() <= new Date(sampledAt).getTime());
  const valueOf = (point: UsagePoint) => service === "all" ? point.total : point[service];
  const activeIndex = Math.min(selectedIndex ?? Math.max(0, available.length - 1), Math.max(0, available.length - 1));
  const active = available[activeIndex];
  const width = 780;
  const height = 248;
  const left = 38;
  const right = 14;
  const top = 18;
  const bottom = 32;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const actualMaxValue = Math.max(0, ...available.map(valueOf));
  // Use whole-request ticks and let sparse activity occupy visible chart space.
  const tickStep = Math.max(1, Math.ceil(actualMaxValue / 4));
  const roundedMax = tickStep * 4;
  const coordinates = available.map((point, index) => ({
    x: left + (index / Math.max(1, series.length - 1)) * chartWidth,
    y: top + chartHeight - (valueOf(point) / roundedMax) * chartHeight,
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = coordinates.length
    ? `${linePath} L${coordinates.at(-1)?.x ?? left} ${top + chartHeight} L${left} ${top + chartHeight} Z`
    : "";
  const labelIndexes = series.length
    ? Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]))
    : [];

  return (
    <div className="usage-chart-wrap" tabIndex={0} role="group"
      aria-label="Interactive request chart. Use arrow keys to explore intervals."
      onPointerLeave={() => setSelectedIndex(null)}
      onBlur={() => setSelectedIndex(null)}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Escape") setSelectedIndex(null);
        else setSelectedIndex(event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : Math.max(0, Math.min(available.length - 1, activeIndex + (event.key === "ArrowRight" ? 1 : -1))));
      }}>

      <svg
        aria-label={`${service === "all" ? "All services" : serviceLabel(service)} request volume. Peak interval: ${actualMaxValue} requests.`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width * width;
          setSelectedIndex(Math.max(0, Math.min(available.length - 1, Math.round((x - left) / chartWidth * (series.length - 1)))));
        }}
        className="usage-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="usage-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#078a52" stopOpacity="0.26" />
            <stop offset="1" stopColor="#078a52" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = top + chartHeight * step;
          const value = Math.round(roundedMax * (1 - step));
          return (
            <g key={step}>
              <line className="chart-gridline" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="chart-axis-label" textAnchor="end" x={left - 9} y={y + 4}>
                {compactFormatter.format(value)}
              </text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#usage-area)" /> : null}
        {linePath ? <path className="chart-line" d={linePath} /> : null}
        {coordinates.map((point, index) => (
          <circle className="chart-point" cx={point.x} cy={point.y} key={available[index].date} r="2.7">
            <title>{`${formatTimestamp(available[index].date)}: ${valueOf(available[index])} requests`}</title>
          </circle>
        ))}
        {selectedIndex !== null && active && coordinates[activeIndex] ? (
          <g aria-hidden="true">
            <line className="chart-crosshair" x1={coordinates[activeIndex].x} x2={coordinates[activeIndex].x} y1={top} y2={top + chartHeight} />
            <circle className="chart-active-point" cx={coordinates[activeIndex].x} cy={coordinates[activeIndex].y} r="5" />
          </g>
        ) : null}
        {labelIndexes.map((index) => (
          <text
            className="chart-axis-label chart-date-label"
            key={series[index]?.date}
            textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
            x={left + index / Math.max(1, series.length - 1) * chartWidth}
            y={height - 5}
          >
            {series[index] ? formatBucket(series[index].date, bucketMinutes) : ""}
          </text>
        ))}
      </svg>
      {selectedIndex !== null && active ? (
        <div className="chart-inspector chart-hover-details">
          <div className="chart-inspector-summary" aria-live="polite" aria-atomic="true">
            <time dateTime={active.date}>{formatTimestamp(active.date)} – {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(Math.min(new Date(active.date).getTime() + bucketMinutes * 60000, new Date(sampledAt).getTime())))}</time>
            <strong>{numberFormatter.format(valueOf(active))} requests · {service === "all" ? "All services" : serviceLabel(service)}</strong>
          </div>
          {service !== "all" && valueOf(active) === 0 && active.total > 0 ? (
            <p className="analytics-period">This interval has activity in other services. Select All services or another service above to plot it.</p>
          ) : null}
          <p className="analytics-period">All services in this interval</p>
          <div className="chart-inspector-services">
            {SERVICES.map((type) => <span key={type}><i className={`legend-dot legend-dot--${type}`} />{serviceLabel(type)} <strong>{numberFormatter.format(active[type])}</strong></span>)}
          </div>
        </div>
      ) : !available.length ? <p className="empty-row">No intervals available yet.</p> : null}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading usage analytics">
      <div className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="metric-card" key={index}>
            <div className="skeleton skeleton-metric-label" />
            <div className="skeleton skeleton-metric-value" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}

export function AnalyticsDashboard({ demo }: { demo: boolean }) {
  const [range, setRange] = useState<UsageRange>("current_window");
  const [service, setService] = useState<ServiceFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [remoteState, setRemoteState] = useState<{
    data: UsagePayload | null;
    error: string;
    requestKey: string;
    range: UsageRange;
  } | null>(null);
  const requestKey = `${range}:${refreshKey}`;
  const [quotaSchedule, setQuotaSchedule] = useState<{ seconds: number } | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  useEffect(() => {
    if (!demo) return;
    const controller = new AbortController();
    dashboardRequest<{ seconds: number }>("/api/auth/quota-window", { signal: controller.signal })
      .then(setQuotaSchedule)
      .catch(() => { if (!controller.signal.aborted) setScheduleError("The quota schedule could not be loaded."); });
    return () => controller.abort();
  }, [demo]);
  const demoData = useMemo(() => (demo && quotaSchedule ? createDemoUsage(range, quotaSchedule.seconds) : null), [range, demo, quotaSchedule]);
  const data = demo ? demoData : remoteState?.range === range ? remoteState.data : null;
  const loading = demo ? !quotaSchedule && !scheduleError : remoteState?.requestKey !== requestKey;
  const error = demo ? scheduleError : remoteState?.requestKey === requestKey ? remoteState.error : "";

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    dashboardRequest<UsageApiPayload>(`/api/auth/usage?time_window=${range}&tz_offset=${new Date().getTimezoneOffset()}`, { signal: controller.signal, cache: "no-store" })
      .then((payload) => {
        if (!controller.signal.aborted) setRemoteState({ data: normalizeUsage(payload), error: "", requestKey, range });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setRemoteState((current) => ({
          data: current?.range === range ? current.data : null,
          error: requestError instanceof Error ? requestError.message : "Usage data could not be loaded.",
          requestKey,
          range,
        }));
      });
    return () => controller.abort();
  }, [range, demo, requestKey]);

  useEffect(() => {
    if (demo) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshKey((current) => current + 1);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [demo]);

  const rangeLabel = RANGES.find((item) => item.value === range)!.label;
  const elapsedHours = data ? Math.max(1 / 3600, (new Date(data.sampled_at ?? data.period_end).getTime() - new Date(data.period_start).getTime()) / 3600000) : 1;

  const busiestService = useMemo(
    () => data?.services.length
      ? data.services.reduce((best, item) => (item.count > best.count ? item : best), data.services[0])
      : undefined,
    [data],
  );

  return (
    <div>
      <PageHeader
        actions={
          <div aria-label="Analytics date range" className="segmented-control" role="group">
            {RANGES.map((item) => (
              <button
                aria-pressed={range === item.value}
                className={range === item.value ? "is-active" : ""}
                key={item.value}
                onClick={() => setRange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        }
        description="See how your applications use Gathos across text to image, image to image, voice, and video."
        eyebrow="Workspace overview"
        title="Usage analytics"
      />

      {loading && !data ? <AnalyticsSkeleton /> : null}

      {error && !data ? (
        <div className="empty-state empty-state--error">
          <span className="empty-state-icon"><RefreshIcon /></span>
          <h2>Usage data is unavailable</h2>
          <p>{error}</p>
          <button className="button button-secondary" onClick={() => { setRefreshKey((current) => current + 1); }} type="button">
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          {error ? <p className="inline-notice inline-notice--warning">Showing the last loaded data. {error}</p> : null}
          {data.truncated ? (
            <p className="inline-notice inline-notice--warning">
              This period contains more than 10,000 requests. Totals and rankings below show the most recent 10,000 records.
            </p>
          ) : null}
          <section aria-label="Usage summary" className="metric-grid">
            <article className="metric-card">
              <span className="metric-icon metric-icon--violet"><AnalyticsIcon /></span>
              <div>
                <p>Total requests</p>
                <strong>{numberFormatter.format(data.total_requests)}{data.truncated ? "+" : ""}</strong>
                <small>{rangeLabel}</small>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon metric-icon--green"><KeyIcon /></span>
              <div>
                <p>Active keys</p>
                <strong>{data.active_keys}</strong>
                <small>Across all services</small>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon metric-icon--blue"><SparklesIcon /></span>
              <div>
                <p>Hourly average</p>
                <strong>{data.truncated ? "≥ " : ""}{numberFormatter.format(Number((data.total_requests / elapsedHours).toFixed(1)))}</strong>
                <small>{data.truncated ? "Recorded requests per elapsed hour" : "Requests per elapsed hour"}</small>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon metric-icon--amber"><RefreshIcon /></span>
              <div>
                <p>Top service</p>
                <strong className="metric-text-value">{data.total_requests ? serviceLabel(busiestService?.type) : "No activity"}</strong>
                <small>{busiestService?.percentage ?? 0}% of activity</small>
              </div>
            </article>
          </section>

          <div className="analytics-main-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Request volume</p>
                  <h2>{service === "all" ? "All services" : serviceLabel(service)} activity</h2>
                  <p className="analytics-period">{formatTimestamp(data.period_start)} – {formatTimestamp(data.period_end)} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                  <p className="analytics-period">{data.bucket_minutes === 360 ? "6-hour" : data.bucket_minutes === 60 ? "Hourly" : "10-minute"} intervals{range === "current_window" ? " · Fixed UTC quota window" : ""}</p>
                </div>
                <button className={`refresh-state ${loading ? "is-loading" : ""}`} disabled={loading || demo} onClick={() => { setRefreshKey((current) => current + 1); }} type="button" aria-label="Refresh usage analytics">
                  <RefreshIcon /> {loading ? "Updating" : demo ? "Demo data" : "Refresh"}
                </button>
              </div>
              <div className="analytics-service-filters" role="group" aria-label="Filter chart by service">
                {(["all", ...SERVICES] as const).map((type) => <button type="button" key={type} aria-pressed={service === type} className={service === type ? "is-active" : ""} onClick={() => setService(type)}>{type === "all" ? "All services" : serviceLabel(type)}</button>)}
              </div>
              <UsageChart key={range} series={data.series} service={service} bucketMinutes={data.bucket_minutes ?? 10} sampledAt={data.sampled_at ?? data.period_end} />
              <p className="analytics-period">{demo ? "Sample data" : "Updates every minute"} · As of {formatTimestamp(data.sampled_at ?? data.period_end)}</p>
              <div className="chart-legend" aria-label="Service breakdown" role="list">
                {data.services.map((service) => (
                  <div className="legend-item" key={service.type} role="listitem">
                    <span className={`legend-dot legend-dot--${service.type}`} />
                    <span>{serviceLabel(service.type)}</span>
                    <strong>{numberFormatter.format(service.count)}</strong>
                    <small>{service.percentage}%</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel service-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Services</p>
                  <h2>Usage mix</h2>
                </div>
              </div>
              <div className="service-stack">
                {data.services.map((service) => (
                  <div className="service-usage-row" key={service.type}>
                    <div>
                      <span>{serviceLabel(service.type)}</span>
                      <strong>{numberFormatter.format(service.count)}</strong>
                    </div>
                    <div className="progress-track">
                      <span
                        className={`progress-fill progress-fill--${service.type}`}
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                    <small>{service.percentage}% of requests</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel usage-limits-panel" aria-label="Request usage limits">
            <div className="panel-heading">
              <div><p className="panel-kicker">Current allowance</p><h2>Usage limits</h2></div>
            </div>
            <p className="analytics-period">Live plan and service limits, independent of the chart date range. All request allowances reset together at the next UTC window boundary. The overall cap covers combined usage across all services. Queued reservations count toward your allowance.</p>
            {!data.limits ? <p className="empty-row">Limit information is unavailable. Refresh to try again.</p>
              : !data.limits.access_active ? <p className="empty-row">An active plan is required to generate content.</p>
              : !data.limits.items.some((limit) => limit.kind === "requests") ? <p className="empty-row">No request caps are configured for your plan.</p>
              : <div className="usage-limits-grid">{data.limits.items.filter((limit) => limit.kind === "requests").map((limit) => (
                <article className="usage-limit-card" key={limit.id}>
                  <h3>{limit.label === "All services" ? "Overall" : limit.label}</h3>
                  <strong aria-label={`${limit.used} of ${limit.limit} requests used`}>{numberFormatter.format(limit.used)}/{numberFormatter.format(limit.limit)}</strong>
                  <p>Used/total{limit.window_seconds ? ` · UTC windows of ${limit.window_seconds / 3600} hours` : ""}</p>
                  {limit.resets_at ? <p>Window resets: <time dateTime={limit.resets_at}>{formatTimestamp(limit.resets_at)}</time> (local time)</p>
                    : <p>{limit.used === 0 ? "No reset pending." : "No scheduled replenishment."}</p>}
                </article>
              ))}</div>}
          </section>

          <div className="analytics-lower-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Credentials</p>
                  <h2>Top API keys</h2>
                </div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Service</th>
                      <th className="align-right">Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data.top_keys.length ? <tr><td colSpan={3} className="empty-row">No API key activity in this period.</td></tr> : null}
                    {data.top_keys.map((key) => (
                      <tr key={key.id}>
                        <td>
                          <strong>{key.name}</strong>
                        </td>
                        <td><span className={`service-badge service-badge--${key.type}`}>{serviceLabel(key.type === "image_gen" ? "image" : key.type)}</span></td>
                        <td className="align-right tabular">{numberFormatter.format(key.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Latest</p>
                  <h2>Recent activity</h2>
                </div>
              </div>
              <div className="activity-list">
                {data.recent_activity.length ? data.recent_activity.map((activity) => (
                  <div className="activity-row" key={activity.id}>
                    <span className={`activity-mark activity-mark--${activity.type}`} />
                    <div>
                      <strong>{serviceLabel(activity.type)}</strong>
                      <small>{activity.key_name || "Dashboard session"}</small>
                    </div>
                    <time dateTime={activity.created_at}>{formatTimestamp(activity.created_at)}</time>
                  </div>
                )) : <p className="empty-row">No requests in this period yet.</p>}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
