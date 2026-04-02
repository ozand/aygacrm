# Agent / API / CLI / MCP Strategy

## Supported interfaces

- **REST API v1** — current and supported now
- **CLI** — planned
- **MCP** — planned

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
