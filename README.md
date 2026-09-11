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

Set the dashboard's server-only `BACKEND_URL` to the FastAPI origin. On the FastAPI backend, set `DASHBOARD_URL=https://dashboard.gathos.com` so OAuth and checkout returns land in this app. The dashboard does not call or require the Express server.

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

Verified sessions reuse `/api/auth/me` account display data for up to 30 seconds,
keyed by a hash of the complete session token in bounded process memory. Missing
or invalid cookies do not call the backend. The shell uses the server-provided user
and no longer makes a second mount-time account request. Protected backend APIs
remain responsible for authorization; cached account data is only for rendering.

Mutations and explicit `/api/auth/me` reads invalidate this process's account cache
before and after forwarding. Subscription confirmation keeps its live polling.
Other server instances and out-of-band account edits become visible after the
30-second TTL; no distributed cache or infrastructure is required.
