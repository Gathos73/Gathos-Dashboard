"use client";

import { useMemo, useState } from "react";

import {
  ArrowUpRightIcon,
  BookIcon,
  CheckIcon,
  CopyIcon,
  ImageIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  VideoIcon,
  VoiceIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { API_BASE, EXAMPLE_LANGUAGES, REQUEST_EXAMPLES, requestExample, type ExampleLanguage } from "@/lib/resource-examples";

type ResourceTab = "docs" | "skills";
type DocSection = "quickstart" | "authentication" | "image" | "image2image" | "tts" | "stt" | "video" | "polling";

const DOC_SECTIONS: Array<{ icon: typeof BookIcon; id: DocSection; label: string; keywords: string }> = [
  { icon: SparklesIcon, id: "quickstart", label: "Quickstart", keywords: "start install first request overview" },
  { icon: TerminalIcon, id: "authentication", label: "Authentication", keywords: "bearer api key authorization security" },
  { icon: ImageIcon, id: "image", label: "Image generation", keywords: "image prompt width height base64" },
  { icon: ImageIcon, id: "image2image", label: "Image to image", keywords: "edit source reference local upload file klein" },
  { icon: VoiceIcon, id: "tts", label: "Text to speech", keywords: "tts voice clone speech audio language" },
  { icon: VoiceIcon, id: "stt", label: "Speech to Text", keywords: "stt transcription transcribe audio upload recording transcript subtitles srt csv timestamps" },
  { icon: VideoIcon, id: "video", label: "Video generation", keywords: "video creator audio style mode" },
  { icon: ArrowUpRightIcon, id: "polling", label: "Polling jobs", keywords: "poll async status queue eta progress" },
];

// Temporarily hide the catalog while keeping it ready to restore.
const AGENT_SKILLS_AVAILABLE = false;

const SKILLS = [
  {
    accent: "green",
    description: "Turn a single idea into a designed presentation deck plus a narrated MP4 with a fresh visual system for every project.",
    file: "idea-to-presentation.md",
    id: "idea-to-presentation",
    output: ".pptx + narrated .mp4",
    services: ["Image", "TTS"],
    title: "Idea-to-Presentation",
  },
  {
    accent: "blue",
    description: "Generate scripts, visuals, voiceover, thumbnails, and an upload-ready 1080p video from a single production brief.",
    file: "youtube-video-factory.md",
    id: "youtube-video-factory",
    output: "1080p .mp4 + thumbnail",
    services: ["Image", "TTS", "Video"],
    title: "YouTube Video Factory",
  },
  {
    accent: "rose",
    description: "Transform narration into a vertical 9:16 reel with generated visuals, transitions, and a preset or cloned voiceover.",
    file: "script-to-reel.md",
    id: "script-to-reel",
    output: "1080 × 1920 vertical .mp4",
    services: ["Image", "TTS", "Video"],
    title: "Script-to-Reel",
  },
];

function CodeBlock({ children, title }: { children: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="code-block">
      <div className="code-block-heading"><span>{title}</span><button onClick={copy} type="button">{copied ? <CheckIcon /> : <CopyIcon />}{copied ? "Copied" : "Copy"}</button></div>
      <pre><code>{children}</code></pre>
    </div>
  );
}

function Endpoint({ description, method, path }: { description: string; method: "GET" | "POST"; path: string }) {
  return (
    <div className="endpoint-card">
      <span className={`method-badge method-badge--${method.toLowerCase()}`}>{method}</span>
      <div><code>{path}</code><p>{description}</p></div>
    </div>
  );
}

function ParameterTable({ rows }: { rows: Array<[string, string, string, string]> }) {
  return (
    <div className="table-scroll docs-table-wrap">
      <table className="data-table docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>{rows.map(([name, type, required, description]) => <tr key={name}><td><code>{name}</code></td><td>{type}</td><td>{required}</td><td>{description}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function RequestExamples({ example }: { example: keyof typeof REQUEST_EXAMPLES }) {
  const [language, setLanguage] = useState<ExampleLanguage>("Bash (curl)");
  return (
    <div>
      <div className="segmented-control" role="group" aria-label="Example language">
        {EXAMPLE_LANGUAGES.map((item) => <button aria-pressed={language === item} className={language === item ? "is-active" : ""} key={item} onClick={() => setLanguage(item)} type="button">{item}</button>)}
      </div>
      <CodeBlock key={`${example}-${language}`} title={`${language} · submit and poll`}>{requestExample(REQUEST_EXAMPLES[example], language)}</CodeBlock>
    </div>
  );
}

function DocArticle({ section }: { section: DocSection }) {
  const articles = {
    quickstart: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Get started</p><h2>Your first Gathos request</h2><p>Submit a job, keep its returned identifier (<code>generation_id</code> for Speech to Text, <code>job_id</code> for other services), and poll until the result is ready. All endpoint paths below are relative to <code>{API_BASE}</code>.</p></div>
        <div className="quickstart-steps">
          <div><span>1</span><div><strong>Create an API key</strong><p>Choose the service you need in API keys. Your active plan must include that product.</p></div></div>
          <div><span>2</span><div><strong>Export the key</strong><p>Set the matching environment variable from Authentication. Run examples on your server or local terminal.</p></div></div>
          <div><span>3</span><div><strong>Submit and poll</strong><p>Choose curl, Python requests, or Node.js below. Each script saves the completed response to <code>result.json</code>; see Polling jobs for output fields.</p></div></div>
        </div>
        <RequestExamples example="image" />
        <div className="endpoint-stack"><Endpoint description="Create an asynchronous image job." method="POST" path="/image-generation" /><Endpoint description="Read job status and result using the same service key." method="GET" path="/image-generation/jobs/{job_id}" /></div>
      </>
    ),
    authentication: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Security</p><h2>Bearer authentication</h2><p>Use the secret returned when you create a key, with authorization for the requested service. Copy the secret at creation; it cannot be recovered later.</p></div>
        <CodeBlock title="Bash · environment variables">{`export GATHOS_IMAGE_KEY='img_live_...'
export GATHOS_IMAGE2IMAGE_KEY='YOUR_IMAGE_TO_IMAGE_KEY'
export GATHOS_TTS_KEY='tts_live_...'
export GATHOS_STT_KEY='YOUR_SPEECH_TO_TEXT_KEY'
export GATHOS_VIDEO_KEY='vid_live_...'
export GATHOS_API_URL='${API_BASE}'`}</CodeBlock>
        <CodeBlock title="Authorization header">{`Authorization: Bearer $GATHOS_IMAGE_KEY`}</CodeBlock>
        <div className="docs-callout"><strong>Keep keys on the server</strong><p>Do not commit them, include them in browser bundles, put them in query strings, or send them to logging and analytics tools. Use separate keys for production and development so either can be revoked independently.</p></div>
      </>
    ),
    image: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Image API</p><h2>Generate an image</h2><p>Send JSON with a text prompt and optional generation settings. Dimensions must be divisible by 16.</p></div>
        <Endpoint description="Submit a text-to-image job as application/json." method="POST" path="/image-generation" />
        <ParameterTable rows={[
          ["prompt", "string", "Yes", "Non-empty visual description, up to 2,000 characters."],
          ["width", "integer", "No", "512–2048, divisible by 16. Default: 1024."],
          ["height", "integer", "No", "512–2048, divisible by 16. Default: 1024."],
          ["use_prompt_enhancer", "boolean", "No", "Enhance the prompt before generation. Default: true."],
          ["seed", "integer", "No", "Default: -1 for random. Set a fixed seed for repeatability."],
        ]} />
        <Endpoint description="Discover supported image resolutions." method="GET" path="/image-generation/resolutions" />
        <RequestExamples example="image" />
      </>
    ),
    image2image: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Image editing API</p><h2>Edit a local image</h2><p>Attach your source image as multipart <code>image1</code> and, optionally, a second reference as <code>image2</code>. Gathos uploads the files to R2 and sends signed HTTP(S) URLs to the generation server. You do not need R2 credentials.</p></div>
        <Endpoint description="Submit an image-to-image job using a key authorized for image-to-image." method="POST" path="/image2image" />
        <ParameterTable rows={[
          ["prompt", "string", "Yes", "Instructions describing the edit."],
          ["image1", "file", "Source required", "Multipart source image. PNG, JPEG, or WebP; maximum 10 MB."],
          ["image2", "file", "No", "Optional second reference image; same formats and size limit."],
          ["image1_path", "string", "Alternative", "Public/signed HTTP(S) source URL. A path on your computer will not work; attach image1 instead."],
          ["image2_path", "string", "Alternative", "Public/signed HTTP(S) URL for the second reference."],
          ["image1_base64 / image2_base64", "string", "Alternative", "Base64 or image data URL. Gathos uploads these to R2 as well. Use one source format per image."],
          ["width / height", "integer", "No", "32–4096 pixels. Defaults: width 896, height 1152."],
          ["seed", "integer", "No", "Default: -1 for random."],
        ]} />
        <Endpoint description="Discover current editing defaults and supported options." method="GET" path="/image2image/config" />
        <p>Export <code>GATHOS_IMAGE2IMAGE_KEY</code> and place <code>reference.png</code> in the working directory. Let your HTTP client set the multipart boundary. Reuse an <code>Idempotency-Key</code> header for retries of the same request.</p>
        <RequestExamples example="image2image" />
        <Endpoint description="Poll with the same key. Completed results may contain an image URL or base64 image." method="GET" path="/image2image/jobs/{job_id}" />
      </>
    ),
    tts: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Voice API</p><h2>Synthesize speech</h2><p>Send JSON for a preset or saved voice. For a reference recording, send multipart form-data with an <code>audio</code> file and text fields.</p></div>
        <Endpoint description="Submit speech synthesis or voice cloning." method="POST" path="/tts" />
        <ParameterTable rows={[
          ["text", "string", "Yes", "Non-empty text to speak, up to 10,000 characters."],
          ["voice", "string", "Without audio", "Preset ID/display name, saved voice ID, or exact saved voice name from GET /tts/voices. No default; omit when uploading audio."],
          ["speed", "number", "No", "0.25–4.0. Default: 1.0 (natural pace)."],
          ["language", "string", "No", "Target language, e.g. en, es, or hi. Default: en. Match the reference language for best cloning quality."],
          ["audio", "file", "Without voice", "Multipart reference audio, 5–20 seconds. mp3, wav, m4a, ogg, webm, or flac."],
          ["ref_text", "string", "No", "Transcript of uploaded reference audio. Saved voices use their stored transcript."],
        ]} />
        <Endpoint description="List preset and saved voices available to your key." method="GET" path="/tts/voices" />
        <h3>Preset or saved voice</h3>
        <RequestExamples example="tts" />
        <h3>Clone from a reference recording</h3>
        <p>Replace <code>reference.wav</code> and <code>ref_text</code> with your recording and its transcript. Let the HTTP client set the multipart Content-Type boundary.</p>
        <RequestExamples example="cloning" />
      </>
    ),
    stt: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Transcription API</p><h2>Speech to Text</h2><p>Turn an audio recording into a transcript with optional timestamps and downloadable JSON, text, subtitle, and CSV files. Submit an audio URL or upload a local file, then poll the returned <code>generation_id</code>.</p></div>
        <div className="docs-callout"><strong>Use a Speech to Text key</strong><p>Your active plan must include Speech to Text. Select it when creating an API key and export the secret as <code>GATHOS_STT_KEY</code>.</p></div>
        <h3>Request identity</h3>
        <p>Both submission endpoints require <code>Idempotency-Key</code> (1–255 characters). Choose a unique value for each new recording or set of options. Reuse that value only when retrying the same request; changing its audio or options returns HTTP 409. The examples read it from <code>GATHOS_STT_REQUEST_ID</code>.</p>
        <CodeBlock title="Bash · configure your request">{`export GATHOS_STT_KEY='YOUR_SPEECH_TO_TEXT_KEY'
export GATHOS_STT_REQUEST_ID='recording-001'`}</CodeBlock>
        <h3>Transcribe an audio URL</h3>
        <Endpoint description="Submit an audio URL as application/json. Returns HTTP 202 with generation_id, status, and replayed." method="POST" path="/stt" />
        <ParameterTable rows={[
          ["audio_url", "string", "Yes for URL input", "Direct public or signed HTTPS audio URL. Local paths, private network addresses, and redirecting URLs are rejected."],
          ["timestamps", "boolean", "No", "Include timestamped segments. Default: true."],
          ["formats", "string[]", "No", "Unique, non-empty selection of json, txt, srt, csv. Default: all four."],
        ]} />
        <p>Replace the example URL with a direct link to your recording. Keep it accessible until Gathos has fetched the audio.</p>
        <RequestExamples example="stt" />
        <h3>Upload a local recording</h3>
        <Endpoint description="Upload audio using multipart/form-data. Returns the same asynchronous response as URL submission." method="POST" path="/stt/upload" />
        <ParameterTable rows={[
          ["file", "file", "Yes", "One audio file: WAV, MP3, FLAC, M4A, OGG, AAC, or WebM."],
          ["timestamps", "boolean text", "No", "Send true or false. Default: true."],
          ["formats", "comma-separated string", "No", "For example json,txt,srt,csv. Default: all four; no duplicate formats."],
        ]} />
        <p>Place <code>recording.wav</code> in your working directory. Use a new request identity when switching from the URL example to this upload. Let the HTTP client set the multipart Content-Type boundary.</p>
        <RequestExamples example="sttUpload" />
        <h3>Read the transcript</h3>
        <Endpoint description="Read status, transcript, timestamped segments, errors, and available artifact download paths using your Speech to Text key." method="GET" path="/stt/jobs/{generation_id}" />
        <ParameterTable rows={[
          ["generation_id", "UUID string", "Always", "The Gathos identifier returned by submission."],
          ["status", "string", "Always", "Poll until succeeded, failed, cancelled, expired, orphaned, or lease_expired. queued and running are intermediate states."],
          ["transcript", "string", "On success", "Recognized text from the recording."],
          ["segments", "array", "When timestamps are available", "Timestamped transcript segments with start, end (seconds), and text."],
          ["artifacts", "object", "On success", "Requested formats mapped to asset_id and download_path."],
          ["error_code", "string | null", "On failure", "Machine-readable reason when available."],
        ]} />
        <CodeBlock title="JSON · completed result (selected fields)">{JSON.stringify({
          generation_id: "11111111-1111-4111-8111-111111111111", status: "succeeded",
          transcript: "Welcome to Gathos.", segments: [{ start: 0.2, end: 1.5, text: "Welcome to Gathos." }],
          artifacts: { txt: { asset_id: "22222222-2222-4222-8222-222222222222", download_path: "/api/v1/stt/jobs/11111111-1111-4111-8111-111111111111/artifacts/txt" } },
          error_code: null,
        }, null, 2)}</CodeBlock>
        <h3>Download transcript files</h3>
        <Endpoint description="Download a requested output format. Redirects to a short-lived signed download URL." method="GET" path="/stt/jobs/{generation_id}/artifacts/{format}" />
        <p>Replace <code>txt</code> with <code>json</code>, <code>srt</code>, or <code>csv</code> to download another requested format. Only the owning account can read the job and its artifacts.</p>
        <CodeBlock title="Bash · download the transcript after the example completes">{`generation_id=$(jq -er '.generation_id' result.json)
curl --fail-with-body --silent --show-error --location --max-time 120 \\
  -H "Authorization: Bearer $GATHOS_STT_KEY" \\
  "${API_BASE}/stt/jobs/$generation_id/artifacts/txt" \\
  --output transcript.txt`}</CodeBlock>
        <h3>Limits and errors</h3>
        <p>Audio must have a finite, positive duration. Configured size and duration limits apply to both URL and uploaded input; plan request, queue, and concurrency limits also apply. Existing jobs and artifacts remain readable when the submission quota is exhausted.</p>
        <ParameterTable rows={[
          ["401 / 403", "HTTP status", "Authentication or access", "Check your API key, its Speech to Text authorization, and active plan access."],
          ["409", "HTTP status", "Identity conflict", "The same request identity was reused with different audio or options."],
          ["413", "HTTP status", "Audio too large", "The audio exceeds the configured upload size limit."],
          ["422", "HTTP status", "Invalid input", "Check the file, duration, URL, formats, and required request identity."],
          ["429", "HTTP status", "Plan limit", "Wait for quota, queue, or concurrency capacity. Follow Retry-After when present."],
        ]} />
        <p>URL audio is fetched and validated after submission. HTTP 202 confirms the request was queued; a URL download or validation failure appears in the job status. Keep the identifier if your polling loop times out so you can resume without submitting again.</p>
      </>
    ),
    video: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Creator API</p><h2>Generate video</h2><p>Send JSON for text or URL inputs, or multipart form-data for file uploads. Completed jobs return a signed <code>video_url</code>.</p></div>
        <Endpoint description="Submit a Creator video job." method="POST" path="/video-generation" />
        <ParameterTable rows={[
          ["prompt", "string", "Yes", "Text description for one short clip, up to 2,000 characters. Use style for reusable looks."],
          ["mode", "string", "No", "t2av (default), ti2av, ta2v, or tia2v."],
          ["image_url", "string", "By mode", "Public/signed HTTP(S) PNG, JPEG, or WebP image URL for ti2av or tia2v. The server fetches it remotely."],
          ["image_path", "string", "No", "Advanced: image path already staged on the GPU worker. Mutually exclusive with image_url. For files on your computer, use the upload example below."],
          ["audio_url", "string", "By mode", "Public/signed HTTP(S) audio URL for ta2v or tia2v, used as a conditioning signal."],
          ["negative_prompt", "string", "No", "Content to avoid. Put text-avoidance terms here, rather than in the positive prompt. Default: empty string."],
          ["width", "integer", "No", "256–2048, divisible by 32. Default: 1280."],
          ["height", "integer", "No", "256–2048, divisible by 32. Default: 736."],
          ["num_frames", "number", "No", "Default: 121. Rounded to the nearest valid 8n + 1 frame count and clamped to 9–513. Examples: 120 → 121; 240 → 241 (about 10 seconds at 24 fps)."],
          ["fps", "number", "No", "8–60 frames per second. Default: 24. Include to choose an explicit playback rate."],
          ["seed", "integer", "No", "Default: -1 for random."],
          ["style", "string | null", "No", "Choose a style name from the options below. The server resolves the preset automatically. Omit for no selected style."],
          ["generate_audio", "boolean", "No", "Omit or send true to include audio. Set false for a silent MP4; conditioning audio can still influence motion."],
          ["prevent_text", "boolean", "No", "Add text-suppression constraints to reduce captions, watermarks, and title cards. Default: true."],
        ]} />
        <div className="docs-callout"><strong>Match inputs to the mode</strong><p>Use exactly one image source for <code>ti2av</code>/<code>tia2v</code> and exactly one audio source for <code>ta2v</code>/<code>tia2v</code>. Other modes reject those inputs. URLs must stay accessible while the job runs.</p></div>
        <Endpoint description="List currently available named styles." method="GET" path="/video-generation/styles" />
        <h3>Style options</h3>
        <div className="table-scroll docs-table-wrap">
          <table className="data-table docs-table">
            <thead><tr><th>Style name</th></tr></thead>
            <tbody>{[
              "Pixar", "Clay / Claymation", "CGI", "Stickman", "Watercolor", "Minecraft",
              "Stylized 3D", "New 3D", "Cinematic", "2D Flat", "Ghibli", "Wool",
              "Chibi", "Paper Cutout", "Lego", "Anime",
            ].map((style) => <tr key={style}><td>{style}</td></tr>)}</tbody>
          </table>
        </div>
        <p>Pass the name as <code>style</code>, for example <code>{'{"style": "Pixar"}'}</code>. For Clay / Claymation, send <code>Clay</code> or <code>Claymation</code>.</p>
        <h3>Text to video</h3>
        <p>No client-generated IDs are required. Each submission creates a new job, subject to queue and concurrency limits. If the queue is busy, try again manually later.</p>
        <RequestExamples example="video" />
        <h3>Image to video</h3>
        <p>Place <code>reference.png</code> in the working directory. Gathos uploads the image to R2 and passes a signed URL to the generation server; no R2 credentials are needed. To also supply audio, use <code>tia2v</code> and add an <code>audio</code> file or <code>audio_url</code>.</p>
        <RequestExamples example="conditionedVideo" />
      </>
    ),
    polling: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Async jobs</p><h2>Poll a submitted job</h2><p>Use the returned <code>generation_id</code> for Speech to Text, or <code>job_id</code> for other services, with the same service key. Each service example includes a polling loop with a three-second interval and a 30-minute deadline. Timing out locally does not cancel the job; keep its ID to resume polling.</p></div>
        <div className="endpoint-stack">
          <Endpoint description="Image job status and result." method="GET" path="/image-generation/jobs/{job_id}" />
          <Endpoint description="Image editing job status and result." method="GET" path="/image2image/jobs/{job_id}" />
          <Endpoint description="Speech job status and result." method="GET" path="/tts/jobs/{job_id}" />
          <Endpoint description="Speech to Text status, transcript, and downloadable artifacts." method="GET" path="/stt/jobs/{generation_id}" />
          <Endpoint description="Video job status and signed output URL." method="GET" path="/video-generation/jobs/{job_id}" />
        </div>
        <ParameterTable rows={[
          ["job_id / generation_id", "string", "Yes", "Use generation_id for Speech to Text; job_id for other services."],
          ["status", "string", "Yes", "Image/TTS: queued, processing, completed, failed. Video may also return pending, running, or cancelled. Stop on completed, failed, or cancelled. Speech to Text succeeds on succeeded and may also terminate with expired, orphaned, or lease_expired."],
          ["result.image_base64", "string", "Image result", "Base64 image bytes in the completed image result."],
          ["result.audio_base64", "string", "TTS result", "Base64 audio bytes in the completed speech result."],
          ["result.content_type", "string", "Image/TTS result", "MIME type of the generated image or audio."],
          ["transcript / segments", "string / array", "Speech to Text result", "Recognized text and optional timestamped segments."],
          ["artifacts", "object", "Speech to Text result", "Requested formats with authenticated download paths."],
          ["video_url", "string", "Video result", "Top-level signed MP4 download URL. Download before the link expires."],
          ["error", "string", "On failure", "Failure details when available."],
          ["progress", "number", "No", "Image/TTS progress when available; not guaranteed."],
          ["eta_seconds", "number", "No", "Image/TTS estimated seconds remaining, when available."],
          ["queue_position", "number", "No", "Image/TTS queue position, when available."],
          ["estimated_completion_time", "ISO string", "No", "Image/TTS estimated UTC completion time, when available."],
        ]} />
        <div className="docs-callout"><strong>Handle HTTP failures separately</strong><p>The example scripts stop on HTTP errors. Fix authentication or validation errors before retrying. For rate limits or temporary unavailability (429/503), wait for <code>Retry-After</code> when present before retrying. A successful HTTP response can still contain a failed job.</p></div>
        <CodeBlock title="Python · decode a completed image or audio result">{`import base64
import json
from pathlib import Path

job = json.loads(Path("result.json").read_text(encoding="utf-8"))
result = job["result"]
field = "image_base64" if "image_base64" in result else "audio_base64"
# Choose the output extension from result["content_type"].
Path("output.bin").write_bytes(base64.b64decode(result[field]))`}</CodeBlock>
      </>
    ),
  };
  return <article className="docs-article">{articles[section]}</article>;
}

function SkillsCatalog({ query }: { query: string }) {
  const filtered = SKILLS.filter((skill) => `${skill.title} ${skill.description} ${skill.output} ${skill.services.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <div className="skills-intro"><div><p className="panel-kicker">Agent-ready workflows</p><h2>Install a complete creative workflow.</h2></div><p>Each skill is a plain Markdown instruction file. It reads your Gathos keys from environment variables and works with shell-capable coding agents.</p></div>
      <div className="skills-grid">
        {filtered.map((skill) => {
          const install = `mkdir -p ~/.claude/skills/${skill.id} && curl -sL https://api.gathos.live/skills/${skill.file} > ~/.claude/skills/${skill.id}/SKILL.md`;
          return (
            <article className={`panel skill-card skill-card--${skill.accent}`} key={skill.id}>
              <div className="skill-card-heading"><span><SparklesIcon /></span><small>Gathos agent skill</small></div>
              <h2>{skill.title}</h2><p>{skill.description}</p>
              <div className="skill-services">{skill.services.map((service) => <span key={service}>{service}</span>)}</div>
              <div className="skill-output"><span>Output</span><strong>{skill.output}</strong></div>
              <CodeBlock title="Install for Claude Code">{install}</CodeBlock>
              <a className="text-link" href={`https://api.gathos.live/skills/${skill.file}`} rel="noreferrer" target="_blank">Read the skill file <ArrowUpRightIcon /></a>
            </article>
          );
        })}
      </div>
      {!filtered.length ? <div className="empty-state"><span className="empty-state-icon"><SearchIcon /></span><h2>No matching skills</h2><p>Try image, video, presentation, or voice.</p></div> : null}
      <section className="skill-notes panel"><h2>Before you run a skill</h2><div><p><span>1</span>Create the typed API keys the workflow needs.</p><p><span>2</span>Export them as <code>GATHOS_IMAGE_KEY</code>, <code>GATHOS_TTS_KEY</code>, and, for Creator flows, <code>GATHOS_VIDEO_KEY</code>.</p><p><span>3</span>Review the skill file before running it, then describe the output you want in plain language.</p></div></section>
    </div>
  );
}

export function ResourcesClient({ initialTab }: { initialTab: ResourceTab }) {
  const [tab, setTab] = useState<ResourceTab>(initialTab);
  const [section, setSection] = useState<DocSection>("quickstart");
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(
    () => DOC_SECTIONS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  function changeTab(nextTab: ResourceTab) {
    setTab(nextTab);
    setQuery("");
  }

  return (
    <div>
      <PageHeader
        actions={<div className="segmented-control" role="group" aria-label="Resource type"><button aria-pressed={tab === "docs"} className={tab === "docs" ? "is-active" : ""} onClick={() => changeTab("docs")} type="button">Documentation</button><button aria-pressed={tab === "skills"} className={tab === "skills" ? "is-active" : ""} onClick={() => changeTab("skills")} type="button">Agent skills{AGENT_SKILLS_AVAILABLE ? "" : " · Coming soon"}</button></div>}
        description={AGENT_SKILLS_AVAILABLE ? "Build against the API, understand asynchronous jobs, and install ready-made agent workflows." : "Build against the API and understand asynchronous jobs. Agent skills are coming soon."}
        eyebrow="Developer resources"
        title="Documentation & skills"
      />

      {tab === "docs" || AGENT_SKILLS_AVAILABLE ? (
      <label className="resource-search"><SearchIcon /><span className="sr-only">Search resources</span><input onChange={(event) => setQuery(event.target.value)} placeholder={tab === "docs" ? "Search documentation…" : "Search skills…"} type="search" value={query} /></label>
      ) : null}

      {tab === "docs" ? (
        <div className="docs-layout">
          <nav aria-label="Documentation sections" className="docs-nav">
            <p className="sidebar-section-label">API reference</p>
            {filteredSections.map((item) => { const Icon = item.icon; return <button aria-current={section === item.id ? "page" : undefined} className={section === item.id ? "is-active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><Icon /><span>{item.label}</span></button>; })}
            {!filteredSections.length ? <p className="docs-nav-empty">No sections found.</p> : null}
            <div className="docs-version"><span className="status-dot" /><div><strong>API v1</strong><small>Production</small></div></div>
          </nav>
          <section className="panel docs-content"><DocArticle section={section} /></section>
        </div>
      ) : AGENT_SKILLS_AVAILABLE ? <SkillsCatalog query={query} /> : (
        <section className="panel empty-state">
          <span className="empty-state-icon"><SparklesIcon /></span>
          <h2>Coming soon</h2>
          <p>Agent skills are on the way. Check back soon for ready-made creative workflows.</p>
        </section>
      )}
    </div>
  );
}
