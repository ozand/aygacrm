# AygaCRM

AygaCRM is an **AI-first personal-relationship CRM**: a canonical contact hub that stores identity, relationship context, and curated communication memory with provenance, for both agents and humans to read and write.

**Status:** active development, pre-1.0. **Stack:** Next.js 16 (App Router) + React 19 + Prisma 7 + PostgreSQL, TypeScript throughout.

AygaCRM is a from-scratch rewrite of [Monica CRM](https://github.com/monicahq/monica) and, per AGPL, a licensed derivative work of it.

---

## For AI agents

AI agents are the **primary** consumers of AygaCRM. You install it, discover what it can do, and operate it — reading and writing contacts, notes, activities, reminders, tasks, journals, gifts, calls, external records — without a human driving the UI.

### 1. Get a token

Every write and most reads need a bearer API token, scoped to specific abilities (`contacts:write`, `notes:read`, `*` for full access, etc.). A human creates one for you in the app under **Settings → API Tokens**, or you're handed one directly. Tokens are shown once at creation — store it, don't lose it.

### 2. Configure the environment

```bash
export AYGACRM_API_TOKEN="<your-token>"
export AYGACRM_API_URL="http://localhost:4000"   # default if unset
```

### 3. Verify

```bash
aygacrm auth whoami
```

This hits `GET /user` with your token and confirms auth works before you do anything else.

### 4. Discover capabilities

No network call needed — the CLI reads the bundled OpenAPI spec directly:

```bash
aygacrm schema contacts          # every verb's request/response shape
aygacrm schema notes create      # just one verb
```

Or read the full spec: [`docs/api/openapi.json`](app/docs/api/openapi.json) (also served live at `GET /api/v1/openapi.json`).

### Three access surfaces

| Surface | Binary / path | Best for |
|---|---|---|
| **CLI** | `aygacrm` (dev: `pnpm cli`, from `app/`) | scripting, one-off reads/writes, shell pipelines |
| **MCP** | `aygacrm-mcp` (stdio server) | tool-calling agents (Claude Code, Claude Desktop, etc.) |
| **REST** | `/api/v1/*`, Bearer auth | custom integrations, any HTTP-capable agent |

Start here: [`AGENTS.md`](AGENTS.md) is the full bootstrap runbook. Detailed task recipes live in [`.claude/skills/`](.claude/skills/) — `aygacrm-cli` for driving the CLI, `aygacrm-ingest` for pushing external-source data in.

---

## For humans

AygaCRM covers: **contacts** (identity, dates, relationships), **activities**, **calls**, **notes**, **reminders**, **tasks**, **gifts**, **journals**, **tags**, and **external records** (curated references from email/Telegram/LinkedIn/etc. attached to a contact with provenance). Contacts can be merged into a single golden record without losing history.

For local development setup (Prisma, PostgreSQL, `npm run dev`, project structure) see [`app/README.md`](app/README.md). For architecture, product scope, and the agent-access strategy, see [`docs/`](docs/) — start with [`docs/architecture/agent-access.md`](docs/architecture/agent-access.md).

---

## Running it & dependencies

Everything AygaCRM needs to run is bundled — one command brings up the whole stack:

```bash
docker compose up -d      # app + PostgreSQL + MinIO, on http://localhost:4000
```

Runtime dependencies (full inventory: [`docs/architecture/dependencies.md`](docs/architecture/dependencies.md)):

- **PostgreSQL** — canonical datastore. **Required.** Bundled.
- **MinIO** (S3-compatible object storage) — files/avatars, private bucket + presigned URLs. Bundled; swappable for AWS S3.
- **SMTP** — outbound reminder email. Optional, not bundled (set `SMTP_URL`).

Deployment details and the published image (`ghcr.io/ozand/aygacrm`): [`docs/deployment/docker.md`](docs/deployment/docker.md).

### Local-first by design

AygaCRM's job is the **golden record** — aggregate contacts from every system (social, chats, LinkedIn, email…), deduplicate and merge them by signal or by hand, with provenance. Data only ever flows **in**: external **collector agents** authenticate to sources themselves and push via the ingestion contract; the product holds no third-party SDKs or credentials and **never exports golden records back** to Google or any big-tech source. See [ADR 0001](docs/architecture/adr/0001-local-first-golden-record-external-collectors.md). Google Workspace is reached exactly this way — an external collector, not a plugin: [`docs/integrations/google-workspace.md`](docs/integrations/google-workspace.md).

---

## License

**AGPL-3.0-or-later.** AygaCRM is a derivative work of [Monica CRM](https://github.com/monicahq/monica) (also AGPL-3.0); copyleft is inherited and cannot be relicensed under more permissive terms. Full text: [`LICENSE.md`](LICENSE.md). Attribution and list of modifications: [`NOTICE.md`](NOTICE.md).
