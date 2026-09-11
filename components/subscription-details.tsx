import type { DashboardUser } from "@/lib/types";

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(date) + " UTC";
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function SubscriptionDetails({ user }: { user: DashboardUser }) {
  const subscription = user.subscription;
  if (!subscription) {
    return (
      <section className="subscription-details" aria-labelledby="subscription-details-title">
        <h2 id="subscription-details-title">Subscription details</h2>
        <p>No current subscription details are available for this account.</p>
      </section>
    );
  }

  const noBilling = ["free", "trial", "complimentary"].includes(subscription.source);
  const interval = user.plan_details?.billing_interval;
  const recurring = !noBilling && (interval === "month" || interval === "year");
  const billing = noBilling ? label(subscription.source)
    : interval === "month" ? "Monthly"
    : interval === "year" ? "Yearly"
    : interval === "none" ? "One-time payment" : "Not available";
  const rows = [
    { label: "Status", value: label(subscription.status) },
    { label: "Billing", value: billing },
    { label: "Started", value: formatDate(subscription.starts_at) },
    ...(recurring ? [
      { label: "Current period starts", value: formatDate(subscription.current_period_starts_at) },
      { label: "Renewal / period end", value: formatDate(subscription.current_period_ends_at) },
    ] : [{ label: "Renewal", value: noBilling || interval === "none" ? "Does not renew" : "Not available" }]),
    ...(subscription.ends_at ? [{
      label: subscription.source === "trial" ? "Trial ends" : "Access ends",
      value: formatDate(subscription.ends_at),
    }] : []),
    ...(subscription.cancelled_at ? [{ label: "Cancelled", value: formatDate(subscription.cancelled_at) }] : []),
    ...(subscription.billing_provider ? [{ label: "Billing provider", value: label(subscription.billing_provider) }] : []),
    ...(subscription.provider_status ? [{ label: "Billing status", value: label(subscription.provider_status) }] : []),
    ...(subscription.provider_subscription_id ? [{ label: "Subscription ID", value: subscription.provider_subscription_id }] : []),
  ];

  return (
    <section className="subscription-details" aria-labelledby="subscription-details-title">
      <h2 id="subscription-details-title">Subscription details</h2>
      <dl>
        {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
    </section>
  );
}
