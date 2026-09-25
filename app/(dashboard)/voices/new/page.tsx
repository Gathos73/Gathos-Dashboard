import type { Metadata } from "next";

import { AddVoiceForm } from "@/components/add-voice-form";
import { isDemoMode } from "@/lib/server-user";

export const metadata: Metadata = { title: "Add a voice" };

export default function AddVoicePage() {
  return <AddVoiceForm demo={isDemoMode()} />;
}
