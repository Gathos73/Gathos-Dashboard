import type { Metadata } from "next";
import { GenerationHistory } from "@/components/generation-history";
import type { GenerationList } from "@/lib/generations";
import { getServerDashboardData, requireUser } from "@/lib/server-user";
export const metadata: Metadata = { title: "Generations" };
export default async function GenerationsPage() {
  const [, initialData] = await Promise.all([
    requireUser(),
    getServerDashboardData<GenerationList>("generations?limit=25&offset=0"),
  ]);
  return <GenerationHistory initialData={initialData} />;
}
