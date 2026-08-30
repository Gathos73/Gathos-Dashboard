import type { Metadata } from "next";

import { PlaygroundClient } from "@/components/playground-client";
import { isDemoMode, requireUser } from "@/lib/server-user";

export const metadata: Metadata = { title: "Playground" };

export default async function PlaygroundPage() {
  const user = await requireUser();
  return <PlaygroundClient demo={isDemoMode()} user={user} />;
}
