# AGENTS.md — AygaCRM agent runbook

This file is for AI agents operating in or against an AygaCRM installation. AygaCRM is an AI-first CRM: agents are first-class operators, not an afterthought bolted onto a human UI. This is a practical runbook, not marketing — every command below is real and verified against `app/src/cli/aygacrm.ts`.

## Identity

AygaCRM is a canonical contact hub: contact identity, relationship context, and curated communication memory (notes, activities, calls, reminders, tasks, gifts, journals, external records), with provenance tracking for who/what supplied each fact. You reach it over HTTP — never touch the database directly, never bypass ability scoping.

## Bootstrap sequence

### 1. Obtain an API token

Tokens are created in the app under **Settings → API Tokens** (component: `app/src/components/features/api-token-manager.tsx`, backed by `app/src/lib/actions/api-tokens.ts`). Each token is a random 256-bit value, shown once at creation (stored server-side only as a SHA-256 hash), and carries one or more **ability** scopes:

```
*                    full access
contacts:read/write/delete
notes:read/write/delete
activities:read/write/delete
reminders:read/write/delete
tasks:read/write/delete
journal:read/write/delete
tags:read/write/delete
```

(Full list: `app/src/lib/api-abilities.ts`.) A request is rejected with `403` if the token lacks the ability its route requires — e.g. every write to `/api/v1/ingest` and most resource `create`/`update`/`delete` calls need `contacts:write` or the matching `<resource>:write`. If you don't have a token yet, ask the human operator to create one for you in Settings, or use one they hand you directly. Tokens can expire (never / 30 / 90 / 365 days) and can be revoked individually or all at once.

### 2. Set environment

```bash
export AYGACRM_API_TOKEN="<your-token>"
export AYGACRM_API_URL="http://localhost:4000"   # default if unset; point at prod/staging as needed
```

The CLI and MCP server both read these two variables (or `.env` in `app/`, or `--token`/`--url` flags on the CLI).

### 3. Confirm the token works

```bash
aygacrm auth whoami
```

Runs `GET /user` with your token. If this fails, stop and fix auth before attempting anything else — don't guess at credentials.

### 4. Discover capabilities

Before writing any data, check the real request/response shape — never guess a field name:

```bash
aygacrm schema <resource>            # all verbs for a resource
aygacrm schema <resource> <verb>     # e.g. `aygacrm schema contacts create`
```

This reads `docs/api/openapi.json` locally — no network call. The same spec is served live at `GET /api/v1/openapi.json`. Resources: `contacts`, `activities`, `calls`, `gifts`, `notes`, `reminders`, `tags`, `tasks`, `records`, `journals` (list/get/create/update/delete each), and `user` (get only).

## The three surfaces — when to use which

| Surface | How | When |
|---|---|---|
| **CLI** (`aygacrm`) | `aygacrm <resource> <verb> [flags]`, Bearer auth over HTTP under the hood | scripting, one-off reads/writes, shell pipelines, anywhere you'd reach for `curl` |
| **MCP** (`aygacrm-mcp`) | stdio MCP server, same auth/abilities/audit as the API | tool-calling agents (Claude Code, Claude Desktop, any MCP client) — register it as an MCP server rather than shelling out |
| **REST** (`/api/v1/*`) | plain HTTP, Bearer auth, OpenAPI-documented | custom integrations, non-CLI/non-MCP agent runtimes |

All three are backed by the identical route/ability/audit-log implementation — pick based on your runtime, not on capability differences.

Dev invocation of the CLI is `pnpm cli <args>` (tsx, run from `app/`) — **never** insert a `--` separator (`pnpm cli -- <args>` breaks flag parsing under pnpm 10). A built, `tsx`-free install exposes the `aygacrm` / `aygacrm-mcp` bins directly (`pnpm build:cli` once, from `app/`).

See [`.claude/skills/aygacrm-cli/SKILL.md`](.claude/skills/aygacrm-cli/SKILL.md) for copy-pasteable CLI recipes.

## Ingesting external-source data

If you've collected data from an external source (Telegram, email, LinkedIn, ...) and want it attached to a contact, do **not** hand-roll a find-or-create-contact → add-identity → add-record sequence. Use the ingestion contract instead:

- REST: `POST /api/v1/ingest` (ability `contacts:write`)
- MCP tool: `aygacrm_ingest`

One call resolves-or-creates the contact from a source handle, idempotently writes the external record, and records field provenance — all in one atomic step. See [`.claude/skills/aygacrm-ingest/SKILL.md`](.claude/skills/aygacrm-ingest/SKILL.md) for the exact body shape and a worked example. This is the recommended way to get third-party data into AygaCRM; a standalone reference adapter for Telegram lives at `app/src/ingest/telegram/`.

## Conventions you must respect

- **Idempotency**: pass `--idempotency-key <key>` (CLI) / an `Idempotency-Key` header (REST/MCP) on writes you might retry. A repeat with the same key + same body replays the original response (`Idempotent-Replay: true`); the same key with a *different* body is a `409`.
- **Pagination**: `aygacrm <resource> list --page-all` follows `links.next` automatically and streams NDJSON (one JSON object per line) — use it instead of hand-rolling a page loop. Otherwise use `--page`/`--limit`/`--sort`.
- **Exit codes** (CLI): `0` ok, `2` auth (missing/invalid token), `3` bad flag or invalid `--data` JSON / `400`/`422`, `4` not found (`404`), `5` server/network/anything else. `429` is reported with the retry-after duration — back off and retry rather than hammering.
- **Dry-run before you write**: `create`/`update`/`delete` all accept `--dry-run`, printing the method/URL/body to stderr without sending the request — use it when you're not fully sure of a payload.
- **Never commit secrets.** `.env` is gitignored; tokens go in environment variables or `.env`, never in code, commit messages, or logs you write to disk.
- **stdout is JSON-only** on the CLI (prompts, dry-run output, and errors go to stderr) — safe to pipe into `jq` or another program.

## More detail

- [`.claude/skills/aygacrm-cli/SKILL.md`](.claude/skills/aygacrm-cli/SKILL.md) — CLI recipes: auth, schema discovery, CRUD with real `--data` examples, pagination, dry-run, idempotency, output formats, exit codes.
- [`.claude/skills/aygacrm-ingest/SKILL.md`](.claude/skills/aygacrm-ingest/SKILL.md) — the ingestion contract in full, with a worked Telegram-style example.
- [`docs/architecture/agent-access.md`](docs/architecture/agent-access.md) — the underlying strategy doc (API/MCP/CLI surface, safety rules, audit requirements).
- [`docs/integrations/ingestion-conventions.md`](docs/integrations/ingestion-conventions.md) — source/kind/metadata validation rules for external records.
