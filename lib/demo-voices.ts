import { DEMO_VOICES } from "@/lib/demo-data";
import type { VoiceSample } from "@/lib/types";

const STORAGE_KEY = "gathos-demo-voices";

export function readDemoVoices(): VoiceSample[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const voices: unknown = saved ? JSON.parse(saved) : null;
    return Array.isArray(voices) ? voices as VoiceSample[] : DEMO_VOICES;
  } catch {
    return DEMO_VOICES;
  }
}

export function saveDemoVoice(voice: VoiceSample) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([voice, ...readDemoVoices()]));
}

export function removeDemoVoice(id: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(readDemoVoices().filter((voice) => voice.id !== id)));
}
