import type { Metadata } from "next";

import { VoicesManager } from "@/components/voices-manager";
import { getServerDashboardData, isDemoMode } from "@/lib/server-user";
import type { VoiceSample } from "@/lib/types";

export const metadata: Metadata = { title: "Voices" };

export default async function VoicesPage() {
  const payload = await getServerDashboardData<{ voices?: VoiceSample[] }>("voices");
  return <VoicesManager demo={isDemoMode()} initialVoices={payload?.voices} />;
}
