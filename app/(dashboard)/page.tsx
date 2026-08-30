import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { isDemoMode } from "@/lib/server-user";
import { redirect } from "next/navigation";

type AnalyticsPageProps = {
  searchParams: Promise<{
    creator_upgrade?: string;
    subscribed?: string;
    tab?: string;
  }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const parameters = await searchParams;
  if (
    parameters.tab === "subscription"
    || parameters.subscribed === "true"
    || parameters.creator_upgrade === "paid"
  ) {
    const nextParameters = new URLSearchParams();
    if (parameters.subscribed) nextParameters.set("subscribed", parameters.subscribed);
    if (parameters.creator_upgrade) nextParameters.set("creator_upgrade", parameters.creator_upgrade);
    redirect(`/subscription${nextParameters.size ? `?${nextParameters.toString()}` : ""}`);
  }
  return <AnalyticsDashboard demo={isDemoMode()} />;
}
