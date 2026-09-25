# Gathos user dashboard

Standalone Next.js App Router dashboard for `dashboard.gathos.com`. It is intentionally separate from both the public Vite site in `../gathos` and the internal console in `../admin`.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs on <http://localhost:3002> and expects the FastAPI backend on <http://localhost:8000>.

For UI work without a running backend, set `DASHBOARD_DEMO_MODE=true` in `.env.local`. Demo mode is accepted only while `NODE_ENV=development` and never bypasses production authentication.

## Production configuration

Set the dashboard's server-only `BACKEND_URL=https://api.gathos.com`. On the FastAPI backend, set `DASHBOARD_URL=https://dashboard.gathos.com`, `BACKEND_URL=https://api.gathos.com`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_REDIRECT_URI=https://api.gathos.com/auth/callback`. Register that exact HTTPS redirect URI in the WorkOS dashboard. AuthKit provides social login and configured SSO alongside the existing Gathos email/password fallback; both flows issue the same Gathos session cookie.

## Security boundary

The catch-all route under `app/api` is an explicit user-API allowlist. It does not forward `/api/admin`, test-only subscription activation, raw database routes, or arbitrary backend paths. Mutations require a same-origin browser request, and credentials remain in the HTTP-only `gathos_session` cookie.

## Generation history

The Generations section lists the signed-in user's generations with status and
product filters. Details show input data, errors, attempts, timestamps, and output
files. Pending work refreshes automatically. Retry uses the backend's eligibility
checks, and downloads use the owned-asset endpoint.

## Session verification and account reuse

Optionally set server-only `SESSION_SECRET` to the same value as FastAPI. This enables
local HMAC verification and expiry checks of the existing cookie (no JWT migration).
Never expose it through `NEXT_PUBLIC_`: this shared secret also permits signing.
Without it, account reads retain backend verification and are not cached.

The protected layout reads shell identity directly from the locally verified signed session and
does not call `/api/auth/me`. Pages that need fresh plan, billing, or profile fields reuse
`/api/auth/me` account data for up to 30 seconds, keyed by a hash of the complete session token in
bounded process memory. Missing or invalid cookies do not call the backend. Protected backend APIs
remain responsible for current authorization; session and cached account data are only for
rendering.

Mutations and explicit `/api/auth/me` reads invalidate this process's account cache
before and after forwarding. Subscription confirmation keeps its live polling.
Other server instances and out-of-band account edits become visible after the
30-second TTL; no distributed cache or infrastructure is required.

## Voice previews

The library and audio are published to the existing voice-samples R2 bucket.
The backend caches the R2 catalog for 60 seconds; playback redirects to a fresh
signed R2 URL. Browsing and playback never contact the proxy or TTS servers,
and preset audio is not bundled in the dashboard.

Publish or refresh the full library from `backend/`:

```bash
python -m scripts.sync_preset_voices --source-directory /path/to/voices
```

The sync command fetches the live proxy catalog, imports every preset and actor
recording from the supplied local files or CSV links, and publishes the catalog only after all uploads succeed. Audio
uses immutable content-based keys; failed imports leave the published library
intact. Existing custom recordings are untouched. Run the command again when
voices are added, removed, or replaced. Backend workers see updates within 60
seconds and can keep using their last catalog during an R2 outage.

The command uses the backend's existing `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `PROXY_URL`, and `PROXY_API_KEY` settings.
The directory option still checks the live catalog and requires every listed
recording, so a partial local collection cannot replace the full library.
Once imported, playback requires only the backend and R2. Demo mode also needs
an authenticated backend for presets.

To import a supplied voice-source CSV together with the original recordings:

```bash
python -m scripts.sync_preset_voices \
  --sources-csv '/path/to/New Voice Speakers - English.csv' \
  --source-directory ../Gathos-Omnivoice/voices
```

CSV sources take precedence over local files and use the `Actual Name` API ID
and `Voice Sample (public link)` columns. Public Google Drive links are downloaded
and checked for WAV/MP3 audio, preventing sharing/login pages from being uploaded
as recordings. The import uses the existing proxy catalog endpoint only.
