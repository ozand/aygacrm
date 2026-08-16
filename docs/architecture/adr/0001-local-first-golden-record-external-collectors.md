# ADR 0001 — Local-first golden record, data enters only via external collectors

## Status

`Accepted` — 2026-08-17

## Context

AygaCRM's core purpose is to be the **golden record** for a person's contacts:
one canonical, deduplicated, provenance-tracked profile per real-world person,
aggregated from many systems — social networks, chats, messengers, LinkedIn,
email, calls, meeting transcripts, and so on. The product must:

- stay **maximally simple** and own exactly one job (aggregate + deduplicate +
  merge, by signals or by hand), not grow into a hub of source-specific
  connectors;
- be **local-first**, with **no vendor lock-in and no big-tech dependency
  risk** — the curated golden records are the user's most sensitive asset and
  must never be handed back to third parties (Google, Meta, LinkedIn, etc.).

The immediate trigger is Google Workspace: we want a person's Google Contacts
and Gmail relationship history in AygaCRM. `googleworkspace/cli`
(https://github.com/googleworkspace/cli) exists and can collect that data. The
open question was architectural: is Google Workspace access a **plugin inside
the product**, an **external application**, or an **external agent that pushes
data in**?

## Decision

**Data enters AygaCRM only through ingestion contracts, pushed by external
collector agents that run outside the product. AygaCRM never reaches out to a
source, and never exports golden records to any source.**

Concretely for Google Workspace: an external agent runs `googleworkspace/cli`
(or the Google People/Gmail APIs directly), authenticates to Google **on its
own**, collects contacts and messages, maps them to AygaCRM's ingestion
contract, and calls `POST /api/v1/ingest` (or the `aygacrm_ingest` MCP tool /
the `aygacrm records` CLI). This is the **same pattern already shipped for
Telegram** (`app/src/ingest/telegram/run.ts`).

Data direction is strictly **one-way, into AygaCRM**. There is no sync-back, no
write path from AygaCRM to Google, and therefore no code that could ever leak a
golden record outward.

## Alternatives considered

1. **Plugin inside the product** (Google SDK + OAuth + token storage living in
   AygaCRM). Rejected: couples the core to a specific vendor's SDK and auth,
   stores Google refresh tokens inside the product, and bloats the one-job core
   with source-specific connector logic. Directly violates "maximally simple"
   and "no big-tech dependency."

2. **Bidirectional sync** (AygaCRM mirrors changes back to Google Contacts).
   Rejected outright: it requires exporting golden records to Google — the
   exact big-tech/vendor risk and local-first violation we are avoiding.

3. **Native polling/webhook connectors in the product** (per-source, still
   inside AygaCRM but read-only). Rejected: still drags vendor SDKs, OAuth apps,
   and rate-limit/retry machinery into the core for every source. The collector
   pattern gives the same result with none of it inside the product.

## Consequences

- **Product stays small.** AygaCRM owns storage, the write/ingest contract,
  identity resolution, deduplication/merge, and provenance — nothing about any
  specific source. Adding a source is writing a new external collector, never
  touching the core.
- **Local-first is structural, not just policy.** Because there is no export
  path, "golden records never leave" is guaranteed by the absence of code, not
  by a rule someone must remember.
- **Secrets stay out of the product.** Google/LinkedIn/etc. credentials live in
  the collector agents, scoped by whoever runs them. AygaCRM only ever holds its
  own API tokens.
- **Collectors are independently deployable and swappable** — a CLI, a cron job,
  a one-shot agent run. They can live in any language and run anywhere.
- **Follow-up work:** document the Google Workspace collector
  (`docs/integrations/google-workspace.md`), extend the ingestion conventions
  with any Google-specific source/kind pairs, and (future epic) ship a reference
  Google Workspace collector mirroring the Telegram adapter.

## Related docs

- [`docs/integrations/roadmap.md`](../../integrations/roadmap.md) — source priority + "contracts, not connectors"
- [`docs/integrations/ingestion-conventions.md`](../../integrations/ingestion-conventions.md) — source/kind + validation
- [`docs/integrations/telegram.md`](../../integrations/telegram.md) — the reference collector this generalizes
- [`docs/integrations/google-workspace.md`](../../integrations/google-workspace.md) — the Google collector plan
- [`docs/architecture/agent-access.md`](../agent-access.md) — API/MCP/CLI surfaces collectors write through
