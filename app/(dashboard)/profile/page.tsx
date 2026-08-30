import type { Metadata } from "next";

import { ProfileCard } from "@/components/profile-card";
import { isDemoMode, requireUser } from "@/lib/server-user";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return <ProfileCard demo={isDemoMode()} user={user} />;
}
