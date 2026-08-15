# EPIC-0002: Golden Record Foundation

## Summary

Design and implement the identity resolution and provenance model that turns AygaCRM from a basic CRM into a golden record platform. This epic defines how canonical contacts relate to external identities and how AygaCRM records the source of truth for each piece of data.

## Problem

Today, contacts are created manually and stored as isolated records with no formal concept of external identity, source attribution, or duplication management. As soon as AygaCRM begins ingesting data from email, messaging, and professional networks, it needs a model that can link multiple external profiles to one canonical contact while preserving where each field came from. Without that foundation, imported data becomes difficult to trust, merge, or reverse.

## Outcome

AygaCRM can represent one person as a canonical contact with multiple linked external identities and a traceable history of how the record evolved. Users can review duplicate candidates, merge contacts with an audit trail, and reverse a merge if needed.

## Scope

### In scope

- Introduce an `ExternalIdentity` model that stores:
  - source system name
  - external source ID
  - profile URL
  - source metadata required for reconciliation and debugging
- Add provenance tracking so each field update records:
  - which source supplied the value
  - when it was observed or updated
  - whether the value replaced an earlier value or supplemented it
- Implement contact merge and unmerge workflows with audit history
- Add duplicate-detection heuristics based on high-signal matching such as name and email
- Expose API endpoints for identity operations, including:
  - attach external identity
  - list identities for a contact
  - surface duplicate candidates
  - merge contacts
  - reverse a merge

### Out of scope

- Actual source connectors and ingestion pipelines
- Automated merge without human confirmation
- Confidence scoring and ranking improvements beyond basic heuristics
- Advanced entity-resolution pipelines or ML-based matching

## Related docs

- [Product Vision](../../product/vision.md)
- [Product Scope](../../product/scope.md)
- [Architecture: Data Model](../../architecture/data-model.md)
- [Product Principles](../../product/principles.md) — provenance first, human override wins

## Success criteria

- A contact can have zero or more linked external identities from different sources
- Creating or updating a record captures the source that provided the data
- Duplicate candidates are surfaced using deterministic matching rules such as name and email overlap
- Two contacts can be merged into a canonical record with a visible audit trail
- A merge can be reversed without corrupting the record history
- Identity and merge APIs are usable by later integration work without schema changes

## Dependencies

- [EPIC-0001: Core CRM Stabilization](./EPIC-0001-core-crm-stabilization.md)
- Data model decisions finalized for contacts, relationships, and audit history

## Risks / open questions

- How should provenance be stored for nested or multi-valued fields such as phone numbers, labels, and relationship metadata?
- What is the minimum audit data needed to reverse a merge safely?
- Should duplicate detection run synchronously on write, asynchronously in the background, or both?
