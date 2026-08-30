"use client";

import { useEffect, useMemo, useState } from "react";

import { AnalyticsIcon, KeyIcon, RefreshIcon, SparklesIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { dashboardRequest } from "@/lib/client-api";
import { createDemoUsage } from "@/lib/demo-data";
import type { UsageApiPayload, UsagePayload, UsagePoint } from "@/lib/types";

const RANGES = [7, 30, 90] as const;
const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function serviceLabel(value?: string): string {
  if (value === "tts") return "Text to speech";
  if (value === "video") return "Video";
  return "Image generation";
}

function normalizeUsage(payload: UsageApiPayload): UsagePayload {
  const total = payload.summary.requests;
  const services = (["image", "tts", "video"] as const).map((type) => ({
    count: payload.by_type[type],
    percentage: total ? Math.round((payload.by_type[type] / total) * 100) : 0,
    type,
  }));
  return {
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
        type: key.type as "image_gen" | "tts" | "video",
    })),
    total_requests: total,
    truncated: payload.truncated,
  };
}

function UsageChart({ series }: { series: UsagePoint[] }) {
  const width = 780;
  const height = 248;
  const left = 38;
  const right = 14;
  const top = 18;
  const bottom = 32;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const actualMaxValue = Math.max(0, ...series.map((point) => point.total));
  const axisMaxValue = Math.max(10, actualMaxValue);
  const roundedMax = Math.ceil(axisMaxValue / 10) * 10;
  const coordinates = series.map((point, index) => ({
    x: left + (index / Math.max(1, series.length - 1)) * chartWidth,
    y: top + chartHeight - (point.total / roundedMax) * chartHeight,
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
    <div className="usage-chart-wrap">
      <svg
        aria-label={`Daily request volume. Highest day: ${actualMaxValue} requests.`}
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
          <circle className="chart-point" cx={point.x} cy={point.y} key={series[index].date} r="2.7">
            <title>{`${formatDay(series[index].date)}: ${series[index].total} requests`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text
            className="chart-axis-label chart-date-label"
            key={series[index]?.date}
            textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
            x={coordinates[index]?.x ?? left}
            y={height - 5}
          >
            {series[index] ? formatDay(series[index].date) : ""}
          </text>
        ))}
      </svg>
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
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [remoteState, setRemoteState] = useState<{
    data: UsagePayload | null;
    error: string;
    requestKey: string;
  } | null>(null);
  const requestKey = `${days}:${refreshKey}`;
  const demoData = useMemo(() => (demo ? createDemoUsage(days) : null), [days, demo]);
  const data = demo ? demoData : remoteState?.data ?? null;
  const loading = !demo && remoteState?.requestKey !== requestKey;
  const error = !demo && remoteState?.requestKey === requestKey ? remoteState.error : "";

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    dashboardRequest<UsageApiPayload>(`/api/auth/usage?days=${days}`, { signal: controller.signal })
      .then((payload) => setRemoteState({ data: normalizeUsage(payload), error: "", requestKey }))
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setRemoteState((current) => ({
          data: current?.data ?? null,
          error: requestError instanceof Error ? requestError.message : "Usage data could not be loaded.",
          requestKey,
        }));
      });
    return () => controller.abort();
  }, [days, demo, requestKey]);

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
            {RANGES.map((range) => (
              <button
                aria-pressed={days === range}
                className={days === range ? "is-active" : ""}
                key={range}
                onClick={() => setDays(range)}
                type="button"
              >
                {range}d
              </button>
            ))}
          </div>
        }
        description="See how your applications use Gathos across image, voice, and video."
        eyebrow="Workspace overview"
        title="Usage analytics"
      />

      {loading && !data ? <AnalyticsSkeleton /> : null}

      {error && !data ? (
        <div className="empty-state empty-state--error">
          <span className="empty-state-icon"><RefreshIcon /></span>
          <h2>Usage data is unavailable</h2>
          <p>{error}</p>
          <button className="button button-secondary" onClick={() => setRefreshKey((current) => current + 1)} type="button">
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          {error ? <p className="inline-notice inline-notice--warning">Showing the last loaded data. {error}</p> : null}
          {data.truncated ? (
            <p className="inline-notice inline-notice--warning">
              This period contains more than 10,000 requests. Totals and rankings below show the first 10,000 records.
            </p>
          ) : null}
          <section aria-label="Usage summary" className="metric-grid">
            <article className="metric-card">
              <span className="metric-icon metric-icon--violet"><AnalyticsIcon /></span>
              <div>
                <p>Total requests</p>
                <strong>{numberFormatter.format(data.total_requests)}{data.truncated ? "+" : ""}</strong>
                <small>Last {data.days} days</small>
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
                <p>Daily average</p>
                <strong>{data.truncated ? "≥ " : ""}{numberFormatter.format(data.average_per_day)}</strong>
                <small>{data.truncated ? "Recorded requests per day" : "Requests per day"}</small>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon metric-icon--amber"><RefreshIcon /></span>
              <div>
                <p>Top service</p>
                <strong className="metric-text-value">{serviceLabel(busiestService?.type)}</strong>
                <small>{busiestService?.percentage ?? 0}% of activity</small>
              </div>
            </article>
          </section>

          <div className="analytics-main-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Request volume</p>
                  <h2>Daily API activity</h2>
                </div>
                <span className={`refresh-state ${loading ? "is-loading" : ""}`}>
                  <RefreshIcon /> {loading ? "Updating" : "Live data"}
                </span>
              </div>
              <UsageChart series={data.series} />
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
