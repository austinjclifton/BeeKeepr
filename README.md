# BeeKeepr

BeeKeepr is a beehive monitoring and analytics platform. The current application is a Node/Express/PostgreSQL backend with a React/Vite/MUI frontend. Telemetry enters through the ingest route today; future phases will add AWS hosting and scheduled simulated telemetry.

## Local Database

Create the local PostgreSQL database and apply the baseline schema:

```sh
createdb beekeepr
cd backend
npm run db:migrate
```

The canonical fresh schema remains [backend/docs/schema.sql](backend/docs/schema.sql).

## Backend Setup

```sh
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Use `DATABASE_URL=postgres://postgres:postgres@localhost:5432/beekeepr` or the equivalent `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values. For hosted PostgreSQL, set `DATABASE_SSL=true` or include `?sslmode=require` in `DATABASE_URL`. Set `CORS_ORIGIN`, `SESSION_SECRET`, and `INGEST_TOKEN` in every non-local deployment. Do not commit real `.env` secrets.

The backend runs on `http://localhost:4000` by default.

## Frontend Setup

```sh
cd frontend
cp .env.example .env
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/ingest` to the backend. Leave `VITE_API_BASE_URL` blank for the proxy, or set it to an explicit backend origin when serving the frontend separately.

## Hybrid Deployment

BeeKeepr supports a split deployment where the frontend is hosted on Vercel and the backend runs separately on AWS.

Frontend on Vercel:

```text
VITE_API_BASE_URL=https://your-backend.example.com
```

For this repo, Vercel should use `frontend/` as the project root because that directory contains the React/Vite SPA served at `beekeepr.live`.

For the production frontend at `beekeepr.live`, keep `VITE_API_BASE_URL=https://api.beekeepr.live` in Vercel so browser requests continue going directly to the separate backend host instead of the frontend origin.

`frontend/vercel.json` needs an SPA rewrite to `/index.html` so refreshing nested client routes like `/dashboard`, `/analytics`, and `/hives` does not return a Vercel 404.

Backend on AWS:

```text
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://...
CORS_ORIGIN=https://your-vercel-app.vercel.app
SESSION_SECRET=replace-me
INGEST_TOKEN=replace-me
APP_BASE_URL=https://your-vercel-app.vercel.app
```

The backend no longer requires a bundled `frontend/dist` directory when it is deployed as an API-only service.

## Data Flow

Device readings are accepted at `POST /ingest/readings` with ingest-token authentication. Readings are stored in 10-minute buckets and may generate warning or critical alerts based on hive-level thresholds, falling back to beekeeper-level defaults.

## Demo Account

BeeKeepr supports an optional login-page demo card for outside users. This still uses normal authentication and does not expose a public dashboard.

Frontend demo controls live in `frontend/.env`:

```sh
VITE_SHOW_DEMO_LOGIN=true
VITE_DEMO_USERNAME=demo
VITE_DEMO_PASSWORD=replace-me
```

Backend demo write protection is controlled by `backend/.env`:

```sh
DEMO_ACCOUNT_USERNAME=demo
```

The demo account should be created and preloaded with hive and reading data separately. Do not commit real demo passwords. New signups without hives will see clean empty states until data exists.

To create the demo beekeeper, locations, hives, and devices without duplicates:

```sh
cd backend
npm run db:seed:demo
```

To generate one current 10-minute demo bucket and exit:

```sh
cd backend
npm run demo:tick
```

To remove stale demo hives and orphaned demo locations that are no longer in the config:

```sh
cd backend
npm run demo:prune-stale
```

To clear demo runtime readings, alerts, and demo-simulator weather without deleting the current demo hives or devices:

```sh
cd backend
npm run demo:reset-readings
```

The demo topology contains five hives across two regions: two in western New York and three in California. Demo seed, tick, and backfill reconciliation now treat `backend/src/config/demoData.config.js` as the source of truth and prune configured-out demo topology before generating new telemetry. `demo:tick` uses each location's configured timezone when generating location-aware external conditions and internal hive readings while deduping by the existing uniqueness rules.

## API Docs

Run the backend and open:

```text
http://localhost:4000/api-docs/
```

The OpenAPI source is [backend/docs/apidoc.yaml](backend/docs/apidoc.yaml).

## Diagrams

Mermaid diagrams live in [backend/docs](backend/docs). The schema baseline and diagrams are maintained in this repository with no legacy school-hosted deployment dependency.

## Validation

```sh
cd backend
npm test

cd ../frontend
npm run build
```
