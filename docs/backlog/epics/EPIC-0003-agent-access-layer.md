# EPIC-0003: Agent Access Layer

## Summary

Harden the REST API and add CLI and MCP interfaces so agents can interact with AygaCRM safely and predictably. This epic focuses on making AygaCRM’s agent-facing surface documented, stable, and auditable.

## Problem

AygaCRM already has an API v1, but it is not yet treated as a contractual interface. It lacks complete documentation, stable error semantics, idempotency support, and the operational safeguards needed for autonomous or semi-autonomous agent use. There is also no CLI or MCP server, which makes scripted operations and LLM integrations unnecessarily brittle.

## Outcome

AygaCRM exposes a reliable agent access layer:

- REST endpoints are documented and predictable
- Write operations can be retried safely when idempotency keys are used
- Errors are structured and machine-actionable
- A CLI provides a thin, script-friendly wrapper around core API operations
- An MCP server exposes approved tools for agent workflows
- All agent actions are logged for audit and review

## Scope

### In scope

- Audit and stabilize existing REST API v1 endpoints
- Publish OpenAPI and/or JSON schema documentation for request and response payloads
- Add idempotency keys to write operations where retries are expected
- Standardize error responses with:
  - stable error codes
  - readable messages
  - actionable hints where possible
- Build a CLI tool that wraps core API operations for scripting and automation
- Build an MCP server that exposes tools for core contact operations
- Add rate limiting and abuse protection appropriate for agent access
- Record comprehensive audit logs for all agent-triggered write actions

### Out of scope

- GraphQL APIs
- WebSocket or other real-time APIs
- Multi-step orchestration or planning logic inside AygaCRM
- Agent autonomy frameworks beyond the exposed tool surface

## Related docs

- [Product Vision](../../product/vision.md)
- [Product Scope](../../product/scope.md)
- [Architecture: Agent Access](../../architecture/agent-access.md)
- [Product Principles](../../product/principles.md) — agents must be auditable

## Success criteria

- All API v1 endpoints used by agents have published request/response schemas
- The CLI can create, update, and retrieve contacts; log interactions; and create tasks
- The MCP server exposes approved tools for contact operations and returns structured results
- Every agent write operation produces an audit log entry that can be traced back to the initiating action
- Error responses are consistent enough for automation to handle without parsing free-form text

## Dependencies

- [EPIC-0001: Core CRM Stabilization](./EPIC-0001-core-crm-stabilization.md)
- [EPIC-0002: Golden Record Foundation](./EPIC-0002-golden-record-foundation.md) for identity-aware write operations and merge-safe access patterns

## Risks / open questions

- Which API endpoints should be considered public agent surface versus internal-only?
- What rate limits are appropriate for local automation versus hosted agents?
- Should the CLI and MCP server share a common client library to avoid divergence?
