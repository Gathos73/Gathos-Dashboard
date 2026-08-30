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
