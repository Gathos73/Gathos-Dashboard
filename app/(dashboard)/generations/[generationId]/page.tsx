import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenerationDetail } from "@/components/generation-detail";
export const metadata: Metadata = { title: "Generation details" };
export default async function GenerationPage({ params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(generationId)) notFound();
  return <GenerationDetail id={generationId} />;
}
