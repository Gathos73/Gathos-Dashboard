import type { Metadata } from "next";

import { PlaygroundIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  // Temporary placeholder. The existing PlaygroundClient remains available to restore.
  return (
    <div>
      <PageHeader
        description="Explore Gathos generation tools in one place."
        eyebrow="API workbench"
        title="Playground"
      />
      <section className="panel empty-state">
        <span className="empty-state-icon"><PlaygroundIcon /></span>
        <h2>Coming soon</h2>
        <p>We’re getting the playground ready. Check back soon to try image, voice, and video generation.</p>
      </section>
    </div>
  );
}


/*
Uncomment below code to enable playground

import type { Metadata } from "next";
import { PlaygroundClient } from "@/components/playground-client";
import { getServerDashboardData, isDemoMode, requireSessionUser } from "@/lib/server-user";
import type { ApiKeyRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Playground" };

export default async function PlaygroundPage() {
  const [user, payload] = await Promise.all([
    requireSessionUser(),
    getServerDashboardData<{ keys?: ApiKeyRecord[] }>("auth/keys"),
  ]);
  return <PlaygroundClient demo={isDemoMode()} initialKeys={payload?.keys} user={user} />;
}

*/