# Agent / API / CLI / MCP Strategy

## Supported interfaces

- **REST API v1** — current and supported now (OpenAPI spec at `/api/v1/openapi.json`)
- **MCP** — real Model Context Protocol server, stdio transport (plus a legacy custom HTTP endpoint)
- **CLI** — partial (direct-DB wrapper); full rebuild planned

## MCP server

A spec-compliant MCP server is available over stdio for clients like Claude
Code / Claude Desktop. It reuses the same tools, ability scoping, and audit
logging as the API.

- Entry point: `pnpm mcp` (or the `monica-mcp` bin) from `app/`.
- Auth: set `MONICA_API_TOKEN` (an API token) in the environment; the server
  validates it and scopes every tool call to that token's abilities.
- Needs `DATABASE_URL` in the environment (loaded from `.env`).

Register with an MCP client, e.g.:

```json
{
  "mcpServers": {
    "monica": {
      "command": "pnpm",
      "args": ["exec", "tsx", "src/mcp/monica-mcp.ts"],
      "cwd": "/path/to/monica/app",
      "env": { "MONICA_API_TOKEN": "<your-token>" }
    }
  }
}
```

A legacy HTTP endpoint at `POST /api/mcp` with a custom `{tool, arguments}`
shape remains for back-compat; new integrations should use the MCP stdio
server.

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
