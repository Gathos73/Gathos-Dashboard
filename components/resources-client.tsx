"use client";

import type { ReactNode } from "react";
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

type ResourceTab = "docs" | "skills";
type DocSection = "quickstart" | "authentication" | "image" | "tts" | "video" | "polling";

const API_BASE = "https://gathos.com/api/v1";

const DOC_SECTIONS: Array<{ icon: typeof BookIcon; id: DocSection; label: string; keywords: string }> = [
  { icon: SparklesIcon, id: "quickstart", label: "Quickstart", keywords: "start install first request overview" },
  { icon: TerminalIcon, id: "authentication", label: "Authentication", keywords: "bearer api key authorization security" },
  { icon: ImageIcon, id: "image", label: "Image generation", keywords: "image prompt width height base64" },
  { icon: VoiceIcon, id: "tts", label: "Text to speech", keywords: "tts voice clone speech audio language" },
  { icon: VideoIcon, id: "video", label: "Video generation", keywords: "video creator audio style mode" },
  { icon: ArrowUpRightIcon, id: "polling", label: "Polling jobs", keywords: "poll async status queue eta progress" },
];

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

function DocArticle({ section }: { section: DocSection }) {
  const articles: Record<DocSection, ReactNode> = {
    quickstart: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Get started</p><h2>Your first Gathos request</h2><p>Every generation is asynchronous: submit a job, keep its ID, and poll until the result is ready. This keeps long-running media work reliable.</p></div>
        <div className="quickstart-steps">
          <div><span>1</span><div><strong>Create a typed API key</strong><p>Use an image, TTS, or Creator video key. Each key is restricted to its service.</p></div></div>
          <div><span>2</span><div><strong>Send it as a Bearer token</strong><p>Keep the key in a server-side environment variable, never client source or a URL.</p></div></div>
          <div><span>3</span><div><strong>Poll the job</strong><p>Wait for <code>completed</code>, then consume the base64 image/audio or video URL.</p></div></div>
        </div>
        <CodeBlock title="Shell · image generation">{`curl -X POST ${API_BASE}/image-generation \\
  -H "Authorization: Bearer $GATHOS_IMAGE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Editorial product photo, soft window light",
    "width": 1024,
    "height": 1024
  }'`}</CodeBlock>
        <div className="endpoint-stack"><Endpoint description="Create an asynchronous image job." method="POST" path="/image-generation" /><Endpoint description="Read job status and result." method="GET" path="/image-generation/jobs/{job_id}" /></div>
      </>
    ),
    authentication: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Security</p><h2>Bearer authentication</h2><p>Use the service-specific secret returned when you create a key. Gathos stores only its hash, so the full secret cannot be recovered later.</p></div>
        <CodeBlock title="Environment variables">{`GATHOS_IMAGE_KEY=img_live_...
GATHOS_TTS_KEY=tts_live_...
GATHOS_VIDEO_KEY=vid_live_...
GATHOS_API_URL=${API_BASE}`}</CodeBlock>
        <CodeBlock title="Authorization header">{`Authorization: Bearer $GATHOS_IMAGE_KEY`}</CodeBlock>
        <div className="docs-callout"><strong>Keep keys on the server</strong><p>Do not commit them, include them in browser bundles, put them in query strings, or send them to logging and analytics tools. Use separate keys for production and development so either can be revoked independently.</p></div>
      </>
    ),
    image: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Image API</p><h2>Generate an image</h2><p>Submit a text prompt and an output canvas. Dimensions must be divisible by 16 and stay between 512 and 2048.</p></div>
        <Endpoint description="Submit a text-to-image job." method="POST" path="/image-generation" />
        <ParameterTable rows={[["prompt", "string", "Yes", "Detailed visual description, up to 2,000 characters."], ["width", "integer", "No", "Output width, 512–2048 and divisible by 16."], ["height", "integer", "No", "Output height, 512–2048 and divisible by 16."], ["guidance_scale", "number", "No", "Prompt adherence from 1.0 to 7.0."], ["steps", "integer", "No", "Sampling steps from 4 to 30."], ["seed", "integer", "No", "Seed for repeatable output."]]}/>
        <CodeBlock title="JavaScript">{`const submit = await fetch("${API_BASE}/image-generation", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.GATHOS_IMAGE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt, width: 1344, height: 768 }),
});

const { job_id } = await submit.json();`}</CodeBlock>
      </>
    ),
    tts: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Voice API</p><h2>Synthesize speech</h2><p>Generate speech with a preset voice ID or the name of a saved custom voice. Match the reference and target language for the strongest cloning quality.</p></div>
        <Endpoint description="Submit text for speech synthesis." method="POST" path="/tts" />
        <ParameterTable rows={[["text", "string", "Yes", "Text to speak, up to 10,000 characters."], ["voice", "string", "Yes*", "Preset voice ID or the name/ID of a saved voice."], ["speed", "number", "No", "Playback speed; 1.0 is natural pace."], ["language", "string", "No", "BCP-style language code such as en, es, or hi."], ["audio", "file", "Yes*", "Reference audio alternative to a saved voice."]]}/>
        <CodeBlock title="Python">{`import os, requests

response = requests.post(
    "${API_BASE}/tts",
    headers={"Authorization": f"Bearer {os.environ['GATHOS_TTS_KEY']}"},
    json={"text": "Welcome to the demo.", "voice": "koko", "speed": 1.0},
)
job_id = response.json()["job_id"]`}</CodeBlock>
      </>
    ),
    video: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Creator API</p><h2>Generate video</h2><p>Creator supports text-only generation and optional image/audio conditioning. Completed jobs return a signed <code>video_url</code>.</p></div>
        <Endpoint description="Submit a Creator video job." method="POST" path="/video-generation" />
        <ParameterTable rows={[["prompt", "string", "Yes", "Scene, motion, camera, and subject description."], ["mode", "string", "No", "t2av, ti2av, ta2v, or tia2v."], ["style", "string", "No", "Named style preset such as Cinematic or Clay."], ["generate_audio", "boolean", "No", "Generate synchronized audio with the video."], ["image_url", "string", "By mode", "Public/signed image input for image-conditioned modes."], ["audio_url", "string", "By mode", "Public/signed audio input for audio-conditioned modes."]]}/>
        <CodeBlock title="JavaScript">{`const response = await fetch("${API_BASE}/video-generation", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.GATHOS_VIDEO_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A paper-cut city unfolding at sunrise",
    mode: "t2av",
    style: "Paper Cutout",
    generate_audio: true,
  }),
});`}</CodeBlock>
      </>
    ),
    polling: (
      <>
        <div className="docs-lead"><p className="panel-kicker">Async jobs</p><h2>Poll without creating load</h2><p>Use a modest interval, stop on terminal states, and respect <code>Retry-After</code> or ETA fields when the service is busy.</p></div>
        <CodeBlock title="Polling helper">{`async function pollJob(url, apiKey, intervalMs = 3000) {
  while (true) {
    const response = await fetch(url, {
      headers: { Authorization: \`Bearer \${apiKey}\` },
    });
    const job = await response.json();

    if (["completed", "done", "succeeded"].includes(job.status)) return job;
    if (["failed", "cancelled"].includes(job.status)) throw new Error(job.error);

    const wait = Number(response.headers.get("Retry-After")) * 1000 || intervalMs;
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}`}</CodeBlock>
        <ParameterTable rows={[["status", "string", "Yes", "queued, processing/running, completed, failed, or cancelled."], ["progress", "number", "No", "Approximate completion percentage."], ["eta_seconds", "number", "No", "Approximate time remaining; guidance, not a guarantee."], ["queue_position", "number", "No", "Position in the worker queue when available."], ["estimated_completion_time", "ISO string", "No", "Approximate UTC completion time."]]}/>
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
          const install = `mkdir -p ~/.claude/skills/${skill.id} && curl -sL https://gathos.com/skills/${skill.file} > ~/.claude/skills/${skill.id}/SKILL.md`;
          return (
            <article className={`panel skill-card skill-card--${skill.accent}`} key={skill.id}>
              <div className="skill-card-heading"><span><SparklesIcon /></span><small>Gathos agent skill</small></div>
              <h2>{skill.title}</h2><p>{skill.description}</p>
              <div className="skill-services">{skill.services.map((service) => <span key={service}>{service}</span>)}</div>
              <div className="skill-output"><span>Output</span><strong>{skill.output}</strong></div>
              <CodeBlock title="Install for Claude Code">{install}</CodeBlock>
              <a className="text-link" href={`https://gathos.com/skills/${skill.file}`} rel="noreferrer" target="_blank">Read the skill file <ArrowUpRightIcon /></a>
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
        actions={<div className="segmented-control" role="group" aria-label="Resource type"><button aria-pressed={tab === "docs"} className={tab === "docs" ? "is-active" : ""} onClick={() => changeTab("docs")} type="button">Documentation</button><button aria-pressed={tab === "skills"} className={tab === "skills" ? "is-active" : ""} onClick={() => changeTab("skills")} type="button">Agent skills</button></div>}
        description="Build against the API, understand asynchronous jobs, and install ready-made agent workflows."
        eyebrow="Developer resources"
        title="Documentation & skills"
      />

      <label className="resource-search"><SearchIcon /><span className="sr-only">Search resources</span><input onChange={(event) => setQuery(event.target.value)} placeholder={tab === "docs" ? "Search documentation…" : "Search skills…"} type="search" value={query} /></label>

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
      ) : <SkillsCatalog query={query} />}
    </div>
  );
}
