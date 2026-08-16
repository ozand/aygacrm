# Docker deployment

AygaCRM ships as a single web image plus its infrastructure — PostgreSQL and
MinIO (S3-compatible object storage). This is the turnkey path to a running
instance — no manual migration step, no separate build tooling on the host.

## Quick start (local / single host)

From the repo root:

```bash
docker compose up -d
```

This starts `postgres:16`, `minio` (with a one-shot `minio-init` job that
creates the bucket), and the `app` container (built from `app/Dockerfile`),
then serves AygaCRM at **http://localhost:4000**. The MinIO web console is at
**http://localhost:9001** and its S3 API at **http://localhost:9000**.

To override defaults (DB credentials, auth secret, public URL), create a
`.env` file next to `docker-compose.yml` (already gitignored) — Compose
loads it automatically for the `${VAR:-default}` substitutions in
`docker-compose.yml`. At minimum, set a real `AUTH_SECRET` before exposing
this beyond your own machine:

```bash
# .env
AUTH_SECRET=<output of: openssl rand -base64 32>
```

## Using the published image directly

Every push to `main` and every `v*` tag publishes an image to GitHub
Container Registry:

```bash
docker pull ghcr.io/ozand/aygacrm:latest
```

Available tags: `latest` (tip of `main`), `<git-sha>`, and semver tags
(`v1.2.3`, `1.2`) for tagged releases. Run it against your own Postgres:

```bash
docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://USER:PASS@HOST:5432/aygacrm?schema=public" \
  -e AUTH_SECRET="<random secret>" \
  -e AUTH_URL="https://your-domain.example" \
  -e NEXT_PUBLIC_APP_URL="https://your-domain.example" \
  ghcr.io/ozand/aygacrm:latest
```

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/aygacrm?schema=public`. Required — the container exits immediately with an error if this is unset. |
| `AUTH_SECRET` | NextAuth signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Public base URL NextAuth uses for callbacks, e.g. `https://your-domain.example`. |
| `NEXT_PUBLIC_APP_URL` | Public base URL the frontend uses to build absolute links. |

### Object storage (files/avatars)

The bundled compose stack wires the app to MinIO automatically (`S3_ENDPOINT`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`,
`S3_FORCE_PATH_STYLE`, and `S3_PUBLIC_ENDPOINT` for browser-facing presigned
URLs). Object storage is **required for the files/avatars feature** but the
rest of the app runs without it. When running the published image standalone
(the `docker run` above), add the `S3_*` vars pointed at your own MinIO/S3 if
you need files. Full inventory:
[`docs/architecture/dependencies.md`](../architecture/dependencies.md).

See `app/.env.example` for every optional integration (OAuth, SMTP, Telegram,
CLI/adapter tokens) — none of those are required for the app to start.

## What the container does on startup

`app/docker-entrypoint.sh` runs on every container start, before the
server:

1. Fails fast with a clear error if `DATABASE_URL` is missing.
2. Runs `prisma db push --skip-generate --accept-data-loss` to create or
   sync the schema. This is idempotent — safe to run against an
   already-up-to-date database — and matches how the rest of the project
   manages schema changes (there is no `prisma/migrations` directory; this
   repo uses `db push`, never `prisma migrate deploy`).
3. Starts the standalone Next.js server (`node server.js`), which listens
   on `PORT` (default `4000`).

## Port

The app listens on **4000** inside and outside the container
(`docker-compose.yml` maps `4000:4000`). This matches the port assumed
elsewhere in the project (CLI default `AYGACRM_API_URL`, CI).

## Build details (for anyone changing the Dockerfile)

- Build context is `app/` — not the repo root. Build manually with:
  `docker build -f app/Dockerfile -t aygacrm ./app`.
- `app/next.config.ts` sets `output: "standalone"` so the image only needs
  the traced production server, not the full `.next` build cache.
- The runtime image copies a **full production `node_modules`** (via a
  `prod-deps` build stage) rather than relying solely on Next's standalone
  dependency tracing. That tracing wouldn't include the `prisma` CLI or its
  query-engine binaries, which the entrypoint needs to run `prisma db
  push` at startup. This trades some image size for reliability.
- `prisma.config.ts` and `prisma/schema.prisma` are both shipped in the
  runtime image — the schema's `datasource` block has no `url` (Prisma 7
  style), so `DATABASE_URL` is wired up via `prisma.config.ts` at runtime,
  and both files are required together.
