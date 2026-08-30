import type { Metadata } from "next";

import { VoicesManager } from "@/components/voices-manager";
import { isDemoMode } from "@/lib/server-user";

export const metadata: Metadata = { title: "Voices" };

export default function VoicesPage() {
  return <VoicesManager demo={isDemoMode()} />;
}
