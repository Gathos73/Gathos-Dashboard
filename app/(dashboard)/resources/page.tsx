import type { Metadata } from "next";

import { ResourcesClient } from "@/components/resources-client";

export const metadata: Metadata = { title: "Documentation & Skills" };

type ResourcesPageProps = { searchParams: Promise<{ tab?: string }> };

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const { tab } = await searchParams;
  return <ResourcesClient initialTab={tab === "skills" ? "skills" : "docs"} />;
}
