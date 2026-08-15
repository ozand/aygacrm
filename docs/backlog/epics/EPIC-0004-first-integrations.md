# EPIC-0004: First Integrations

## Summary

Build the first storage and ingestion interfaces for external relationship references and content. This epic establishes how AygaCRM receives curated data from external agents and systems so the golden record and relationship memory can reflect real-world context without AygaCRM owning native source integrations.

## Problem

Without a structured ingestion layer, AygaCRM is only a manual CRM. The product’s core value depends on storing important relationship context from the channels where relationships actually happen. The system needs a repeatable external content/reference model and a small set of high-value sources to validate provenance, attribution, and duplicate handling in practice.

## Outcome

AygaCRM can receive structured references, snippets, and transcripts from priority external systems. Ingested items create or update external identities where applicable, write provenance data, and enrich the canonical contact without losing source history.

## Scope

### In scope

- Define a storage model for external references, snippets, and transcripts
- Define a source-aware ingestion contract for API, CLI, and MCP writers
- Standardize normalization logic so each source maps into AygaCRM’s internal relationship context model
- Add validation, attribution, and retry behavior for ingestion failures
- Support email as a source of curated contact context and references
- Support Telegram as a source of curated contact context and references
- Support LinkedIn as a source of professional references and identity context
- Support Todoist and Notion as sources of related context and references
- Support Zoom and phone transcripts as first-class content types
- Ensure all ingested items are written with provenance and linked to existing or newly created external identities when applicable
- Make duplicate detection work across ingested references so new data does not fragment the golden record

### Out of scope

- Native source authentication flows
- Webhooks, polling jobs, or background sync runners as AygaCRM-owned responsibilities
- Two-way synchronization back to source systems
- WhatsApp, VK, and Facebook source support for this epic
- Indiscriminate full-content ingestion as the default behavior

## Related docs

- [Product Vision](../../product/vision.md)
- [Product Scope](../../product/scope.md)
- [Architecture: Data Model](../../architecture/data-model.md)
- [Integrations Roadmap](../../integrations/roadmap.md)
- [Product Principles](../../product/principles.md) — provenance first, raw is immutable

## Success criteria

- The storage model can represent external references, snippets, and transcripts with source attribution
- The ingestion contract supports API, CLI, and MCP writes from external agents or systems
- Email, Telegram, LinkedIn, Todoist, Notion, Zoom, and phone transcript content can be ingested in a source-aware way
- Ingested items retain provenance for all significant fields and references
- Duplicate detection works across at least the first ingested sources

## Dependencies

- [EPIC-0001: Core CRM Stabilization](./EPIC-0001-core-crm-stabilization.md)
- [EPIC-0002: Golden Record Foundation](./EPIC-0002-golden-record-foundation.md)
- [EPIC-0003: Agent Access Layer](./EPIC-0003-agent-access-layer.md) for connector services that need to write into AygaCRM programmatically

## Risks / open questions

- Which content types should be normalized at ingest time versus stored as lightly processed references?
- Which source should be implemented first to maximize signal and minimize ingestion complexity?
- What attribution and retention rules should apply to transcripts and reference snippets?
