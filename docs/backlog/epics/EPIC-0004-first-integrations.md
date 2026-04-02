# EPIC-0004: First Integrations

## Summary

Build the first source connectors that feed real-world relationship data into Monica. This epic establishes the integration framework and delivers the first production-shaped connectors so the golden record begins to reflect live external systems rather than only manual entry.

## Problem

Without integrations, Monica is only a manual CRM. The product’s core value depends on aggregating contact data from the channels where relationships actually happen. The system needs a repeatable connector pattern and a small set of high-value sources to validate how external identities, provenance, and duplicate detection work in practice.

## Outcome

Monica can ingest and sync contact data from at least two or three priority external systems. Imported records create or update external identities, write provenance data, and enrich the canonical contact without losing source history.

## Scope

### In scope

- Define an integration framework with a clear connector interface
- Standardize normalization logic so each source maps into Monica’s canonical contact model
- Add error handling and retry behavior for connector failures
- Build an email connector that extracts contacts from email metadata
- Build a Telegram connector that syncs contacts and relevant identity data from Telegram contacts/chats
- Build a LinkedIn connector that enriches contacts with professional profile data
- Ensure all imported data is written with provenance and linked to existing or newly created external identities
- Make duplicate detection work across imported sources so new data does not fragment the golden record

### Out of scope

- WhatsApp, VK, and Facebook connectors
- Conversation-content import from message bodies as a primary feature
- Two-way synchronization back to source systems
- Real-time sync; batch or scheduled sync is sufficient for the first wave

## Related docs

- [Product Vision](../../product/vision.md)
- [Product Scope](../../product/scope.md)
- [Architecture: Data Model](../../architecture/data-model.md)
- [Integrations Roadmap](../../integrations/roadmap.md)
- [Product Principles](../../product/principles.md) — provenance first, raw is immutable

## Success criteria

- The integration framework defines a stable connector contract that future sources can implement consistently
- The email connector imports contacts and links them to email-based external identities
- The Telegram connector syncs contacts and links phone or username identities where available
- The LinkedIn connector enriches existing contacts with professional profile data without duplicating records
- Imported records retain provenance for all significant fields
- Duplicate detection works across at least the first integrated sources

## Dependencies

- [EPIC-0001: Core CRM Stabilization](./EPIC-0001-core-crm-stabilization.md)
- [EPIC-0002: Golden Record Foundation](./EPIC-0002-golden-record-foundation.md)
- [EPIC-0003: Agent Access Layer](./EPIC-0003-agent-access-layer.md) for connector services that need to write into Monica programmatically

## Risks / open questions

- What authentication and consent model will each source connector require?
- Which source should be implemented first to maximize signal and minimize integration complexity?
- How much normalization should happen in the connector versus in Monica’s internal ingestion layer?
