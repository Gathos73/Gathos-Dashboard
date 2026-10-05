import type { Metadata } from "next";

import { ProfileCard } from "@/components/profile-card";
import { isDemoMode, requireSessionUser } from "@/lib/server-user";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireSessionUser();
  return <ProfileCard demo={isDemoMode()} user={user} />;
}
