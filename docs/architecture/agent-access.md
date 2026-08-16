# Agent / API / CLI / MCP Strategy

## Supported interfaces

- **REST API v1** — current and supported now (OpenAPI spec at `/api/v1/openapi.json`)
- **MCP** — real Model Context Protocol server, stdio transport (plus a legacy custom HTTP endpoint)
- **CLI** — REST API v1 client (`aygacrm`), plus a legacy direct-DB local wrapper

## MCP server

A spec-compliant MCP server is available over stdio for clients like Claude
Code / Claude Desktop. It reuses the same tools, ability scoping, and audit
logging as the API.

- Entry point: `pnpm mcp` (or the `aygacrm-mcp` bin) from `app/`.
- Auth: set `AYGACRM_API_TOKEN` (an API token) in the environment; the server
  validates it and scopes every tool call to that token's abilities.
- Needs `DATABASE_URL` in the environment (loaded from `.env`).

Register with an MCP client, e.g.:

```json
{
  "mcpServers": {
    "aygacrm": {
      "command": "pnpm",
      "args": ["exec", "tsx", "src/mcp/aygacrm-mcp.ts"],
      "cwd": "/path/to/aygacrm/app",
      "env": { "AYGACRM_API_TOKEN": "<your-token>" }
    }
  }
}
```

A legacy HTTP endpoint at `POST /api/mcp` with a custom `{tool, arguments}`
shape remains for back-compat; new integrations should use the MCP stdio
server.

### Host install (plain Node, no `tsx`/source checkout)

`pnpm mcp` (via `tsx`) is the dev-loop path. For a host that should run the
server without a TypeScript toolchain, build it once with tsup and run the
bundled `.mjs` output under plain `node`:

```bash
cd app
pnpm build:cli                    # -> dist/aygacrm-mcp.mjs, dist/aygacrm.mjs
node dist/aygacrm-mcp.mjs         # or the installed `aygacrm-mcp` bin
```

`bin.aygacrm-mcp` in `app/package.json` points at `dist/aygacrm-mcp.mjs`, so
`npm i -g` (or `pnpm link`) after building exposes `aygacrm-mcp` as a normal
executable:

```json
{
  "mcpServers": {
    "aygacrm": {
      "command": "aygacrm-mcp",
      "env": { "AYGACRM_API_TOKEN": "<your-token>" }
    }
  }
}
```

`node_modules` still needs the runtime dependencies installed (they are not
bundled into `dist/`) — only the `tsx`/TypeScript compile step is replaced.

## CLI

Two CLIs live under `app/src/cli/`:

- **`aygacrm`** (`src/cli/aygacrm.ts`, `pnpm cli`) — a REST API v1 client. Talks
  to the API over HTTP with an API token, so it respects ability scoping,
  audit, rate-limiting, and idempotency. Noun-verb: `aygacrm <resource> <verb>`.
  For a plain-Node install (no `tsx`), run `pnpm build:cli` once and use
  `dist/aygacrm.mjs` / the `aygacrm` bin instead — see the host-install note
  under the MCP section above (same tsup build covers both entry points).
  - Auth: `--token` or `AYGACRM_API_TOKEN`; base URL via `--url` or
    `AYGACRM_API_URL` (default `http://localhost:4000`).
  - Verbs: `list` / `get <id>` / `create --data '<json>'` /
    `update <id> --data '<json>'` / `delete <id>` across contacts, activities,
    calls, gifts, notes, reminders, tags, tasks, records, journals; `user get`.
  - `--format json|table`, `--page-all` (NDJSON), `--dry-run`, `--yes`,
    `schema <resource> [verb]`, `auth whoami`.
  - Exit codes: 0 ok, 2 auth, 3 validation, 4 not-found, 5 server/network.
  - stdout is JSON-only (prompts/status/errors go to stderr) so output pipes
    cleanly.
- **`aygacrm-cli`** (`src/cli/aygacrm-cli.ts`) — legacy direct-DB wrapper for
  trusted local automation (no auth; needs `DATABASE_URL`).

## Current API

The current API uses token-based authentication with scoped abilities and exposes CRUD for core entities. It is designed for controlled automation rather than broad unrestricted access.

## Authentication

API tokens carry ability scoping such as `read`, `write`, and `delete`. Scope checks should happen before the write path executes.

## Safety rules

- Writes should be idempotent where practical.
- Every mutation should be logged for auditability.
- Permissions must be scoped to the smallest useful surface.

## Allowed actions for agents

- Contact CRUD
- Interaction logging
- Enrichment
- Timeline query

Agents can read and update what they are explicitly allowed to touch, but they should not be able to make broad untracked changes.

## Audit requirements

Every write must log the actor, action, timestamp, and affected entities. If the actor is an agent, the record should identify that fact clearly.

## Tool schema conventions for MCP

Tool schemas are to be defined when MCP work begins. The default rule is to keep tool contracts narrow, explicit, and auditable.

## Example workflows

- An agent enriches a contact from LinkedIn and updates missing title or company fields.
- An agent logs a call summary into the contact timeline.
- An agent creates a task in the connected task system after a relationship follow-up is identified.
