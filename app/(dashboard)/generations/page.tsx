import type { Metadata } from "next";
import { GenerationHistory } from "@/components/generation-history";
import { requireUser } from "@/lib/server-user";
export const metadata: Metadata = { title: "Generations" };
export default async function GenerationsPage() {
  await requireUser();
  return <GenerationHistory />;
}
