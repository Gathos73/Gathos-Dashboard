export const API_BASE = "https://api.gathos.live/api/v1";

export const EXAMPLE_LANGUAGES = ["Bash (curl)", "Python (requests)", "JavaScript (Node.js)"] as const;
export type ExampleLanguage = (typeof EXAMPLE_LANGUAGES)[number];

type Example = {
  path: string;
  key: string;
  payload: Record<string, string | number | boolean | string[]>;
  idempotencyEnv?: string;
  idField?: string;
  successStatus?: string;
  pollPath?: string;
  upload?: { field: string; filename: string; contentType: string };
};

// Public API examples: only include fields forwarded by backend/app/routers/api.
export const REQUEST_EXAMPLES = {
  image: {
    path: "image-generation", key: "GATHOS_IMAGE_KEY",
    payload: { prompt: "Editorial product photo, soft window light", width: 1024, height: 1024, use_prompt_enhancer: true, seed: -1 },
  },
  image2image: {
    path: "image2image", key: "GATHOS_IMAGE2IMAGE_KEY",
    payload: { prompt: "Turn the scene into a watercolor illustration", width: 1024, height: 1024 },
    upload: { field: "image1", filename: "reference.png", contentType: "image/png" },
  },
  tts: {
    path: "tts", key: "GATHOS_TTS_KEY",
    payload: { text: "Welcome to the demo.", voice: "koko", speed: 1.0, language: "en" },
  },
  cloning: {
    path: "tts", key: "GATHOS_TTS_KEY",
    payload: { text: "Welcome to the demo.", language: "en", speed: 1.0, ref_text: "This is the transcript of my reference recording." },
    upload: { field: "audio", filename: "reference.wav", contentType: "audio/wav" },
  },
  stt: {
    path: "stt", key: "GATHOS_STT_KEY", idempotencyEnv: "GATHOS_STT_REQUEST_ID",
    idField: "generation_id", successStatus: "succeeded",
    payload: { audio_url: "https://example.com/recording.wav", timestamps: true, formats: ["json", "txt", "srt", "csv"] },
  },
  sttUpload: {
    path: "stt/upload", pollPath: "stt", key: "GATHOS_STT_KEY", idempotencyEnv: "GATHOS_STT_REQUEST_ID",
    idField: "generation_id", successStatus: "succeeded",
    payload: { timestamps: true, formats: ["json", "txt", "srt", "csv"] },
    upload: { field: "file", filename: "recording.wav", contentType: "audio/wav" },
  },
  video: {
    path: "video-generation", key: "GATHOS_VIDEO_KEY",
    successStatus: "done",
    payload: { prompt: "A paper-cut city unfolding at sunrise", mode: "t2av", width: 1280, height: 736, fps: 24, num_frames: 121, seed: -1, generate_audio: true, prevent_text: true },
  },
  conditionedVideo: {
    path: "video-generation", key: "GATHOS_VIDEO_KEY",
    successStatus: "done",
    payload: { prompt: "Slow camera push toward the subject", mode: "ti2av", width: 1280, height: 736, num_frames: 121 },
    upload: { field: "image", filename: "reference.png", contentType: "image/png" },
  },
} satisfies Record<string, Example>;

export function requestExample(example: Example, language: ExampleLanguage): string {
  const { path, key, payload, upload } = example;
  const url = `${API_BASE}/${path}`;
  const pollUrl = `${API_BASE}/${example.pollPath ?? path}`;
  const idField = example.idField ?? "job_id";
  const success = example.successStatus ?? "completed";
  const failures = example.idField === "generation_id" ? ["failed", "cancelled", "expired", "orphaned", "lease_expired"] : ["failed", "cancelled"];
  const identity = example.idempotencyEnv;
  const json = JSON.stringify(payload, null, 2);
  if (language === "Bash (curl)") {
    const body = upload
      ? [...Object.entries(payload).map(([name, value]) => `  --form-string '${name}=${value}'`), `  -F '${upload.field}=@${upload.filename};type=${upload.contentType}'`].join(" \\\n")
      : `  -H 'Content-Type: application/json' \\\n  -d '${json}'`;
    return `#!/usr/bin/env bash
set -euo pipefail
# Requires curl and jq. Export ${key}${identity ? ` and ${identity}` : ""} first.${upload ? `\n# Place ${upload.filename} in the current directory.` : ""}
response=$(curl --fail-with-body --silent --show-error --max-time 120 \\
  '${url}' \\
  -H "Authorization: Bearer $${key}" \\
${identity ? `  -H "Idempotency-Key: $${identity}" \\\n` : ""}${body})
job_id=$(printf '%s' "$response" | jq -er '.${idField} | strings | select(length > 0)')
echo "Job ID: $job_id" >&2

# Poll for up to 30 minutes; keep the job ID to resume later.
deadline=$((SECONDS + 1800))
while (( SECONDS < deadline )); do
  job=$(curl --fail-with-body --silent --show-error --max-time 60 \\
    "${pollUrl}/jobs/$job_id" \\
    -H "Authorization: Bearer $${key}")
  status=$(printf '%s' "$job" | jq -r '.status')
  case "$status" in
    ${success}) printf '%s\\n' "$job" > result.json; echo 'Saved result.json'; exit 0 ;;
    ${failures.join("|")}) printf '%s\\n' "$job" >&2; exit 1 ;;
  esac
  sleep 3
done
echo "Polling timed out; resume with job ID $job_id" >&2
exit 1`;
  }
  if (language === "Python (requests)") {
    const submit = upload
      ? `with open("${upload.filename}", "rb") as reference:
    response = requests.post(
        url, headers=headers, data={name: ",".join(value) if isinstance(value, list) else str(value).lower() if isinstance(value, bool) else value for name, value in payload.items()},
        files={"${upload.field}": ("${upload.filename}", reference, "${upload.contentType}")},
        timeout=120,
    )`
      : `response = requests.post(url, headers=headers, json=payload, timeout=120)`;
    return `# Install: python -m pip install requests
# Export ${key}${identity ? ` and ${identity}` : ""} before running.
import json
import os
import time
from pathlib import Path
import requests

url = "${url}"
headers = {"Authorization": f"Bearer {os.environ['${key}']}"${identity ? `, "Idempotency-Key": os.environ["${identity}"]` : ""}}
payload = json.loads('''${json}''')
${submit}
response.raise_for_status()
job_id = response.json()["${idField}"]
print(f"Job ID: {job_id}")

deadline = time.monotonic() + 1800
while time.monotonic() < deadline:
    response = requests.get(f"${pollUrl}/jobs/{job_id}", headers=headers, timeout=60)
    response.raise_for_status()
    job = response.json()
    if job["status"] == "${success}":
        Path("result.json").write_text(json.dumps(job), encoding="utf-8")
        print("Saved result.json")
        break
    if job["status"] in ${JSON.stringify(failures)}:
        raise RuntimeError(job.get("error") or job.get("error_code") or job["status"])
    time.sleep(3)
else:
    raise TimeoutError(f"Polling timed out; resume with job ID {job_id}")`;
  }
  const body = upload
    ? `const form = new FormData();
for (const [name, value] of Object.entries(payload)) form.set(name, Array.isArray(value) ? value.join(",") : String(value));
form.set("${upload.field}", new Blob([await readFile("${upload.filename}")], { type: "${upload.contentType}" }), "${upload.filename}");`
    : `headers["Content-Type"] = "application/json";`;
  return `// Node.js 22+. Save as example.mjs and run: node example.mjs
// Export ${key} before running.
import { ${upload ? "readFile, " : ""}writeFile } from "node:fs/promises";

const apiKey = process.env.${key};
if (!apiKey) throw new Error("Set ${key}");
const url = "${url}";
const headers = { Authorization: \`Bearer \${apiKey}\` };${identity ? `\nconst requestId = process.env.${identity};\nif (!requestId) throw new Error("Set ${identity}");\nheaders["Idempotency-Key"] = requestId;` : ""}
const payload = ${json};
${body}
const submitted = await fetch(url, {
  method: "POST", headers,
  body: ${upload ? "form" : "JSON.stringify(payload)"},
  signal: AbortSignal.timeout(120_000),
});
if (!submitted.ok) throw new Error(\`HTTP \${submitted.status}: \${await submitted.text()}\`);
const { ${idField}: job_id } = await submitted.json();
if (!job_id) throw new Error("Submission did not return a ${idField}");
console.log("Job ID:", job_id);

let completed = false;
const deadline = Date.now() + 30 * 60_000;
while (Date.now() < deadline) {
  const response = await fetch(\`${pollUrl}/jobs/\${encodeURIComponent(job_id)}\`, {
    headers: { Authorization: \`Bearer \${apiKey}\` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
  const job = await response.json();
  if (job.status === "${success}") {
    await writeFile("result.json", JSON.stringify(job, null, 2));
    console.log("Saved result.json");
    completed = true;
    break;
  }
  if (${JSON.stringify(failures)}.includes(job.status)) throw new Error(job.error || job.error_code || job.status);
  await new Promise(resolve => setTimeout(resolve, 3000));
}
if (!completed) throw new Error(\`Polling timed out; resume with job ID \${job_id}\`);`;
}
