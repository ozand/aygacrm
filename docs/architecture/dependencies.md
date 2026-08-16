# External dependencies

What AygaCRM needs at runtime, and why. The design goal is **few, replaceable,
self-hostable** dependencies — local-first, no vendor lock-in (see
[ADR 0001](adr/0001-local-first-golden-record-external-collectors.md)).

## Bundled infrastructure (ships in `docker-compose.yml`)

| Service | Role | Required? | Env |
|---|---|---|---|
| **PostgreSQL 16** | Canonical datastore — contacts, golden records, external records, provenance, auth. | **Yes.** The app will not start without it. | `DATABASE_URL` |
| **MinIO** (S3-compatible object storage) | File & avatar storage. Bucket is private; the app serves objects via short-lived presigned GET URLs. | Required for the files/avatars feature; the rest of the app runs without it (`isS3Configured()` gates usage). | `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` |

Both run as containers in the bundled stack — `docker compose up` provisions
Postgres, MinIO, and the bucket automatically. MinIO is swappable for AWS S3 or
any S3-compatible store by pointing the `S3_*` vars elsewhere (set
`S3_FORCE_PATH_STYLE=0` for AWS).

## Optional external services (not bundled)

| Service | Role | Behavior when unset | Env |
|---|---|---|---|
| **SMTP server** | Outbound reminder email. | Delivery is silently skipped. | `SMTP_URL`, `SMTP_FROM` |
| **Google / GitHub OAuth** | Social login providers (login only — unrelated to data ingestion). | Buttons hidden; email/password login still works. | `NEXT_PUBLIC_AUTH_GOOGLE`, `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_AUTH_GITHUB`, `GITHUB_CLIENT_ID/SECRET` |
| **Telegram Bot API** | The reference ingestion collector (`pnpm ingest:telegram`). Runs as a separate process, not the web app. | No Telegram ingestion. | `TELEGRAM_BOT_TOKEN` |

## Not a dependency: data sources

Third-party data sources (Google Workspace, LinkedIn, WhatsApp, Zoom, …) are
**not** runtime dependencies of the product. AygaCRM never connects to them.
External **collector agents** authenticate to those sources themselves and push
data in via the ingestion contract (`POST /api/v1/ingest` / `aygacrm_ingest` /
`aygacrm records`). The product holds no source SDKs and no source credentials.
See [ADR 0001](adr/0001-local-first-golden-record-external-collectors.md) and
the [integration roadmap](../integrations/roadmap.md).

## Runtime/build toolchain

Node 22, pnpm, Prisma 7 (client + query engine bundled into the image). No other
system packages are required in the container.
