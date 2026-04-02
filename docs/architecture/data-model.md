# Data Model Principles

## Core entities

- **Account** — authentication and ownership boundary.
- **User** — the signed-in person associated with an account.
- **Vault** — the scoped CRM container that holds a user’s data boundary.
- **Contact** — the canonical relationship record for a person.

## Identity model

Contact is the canonical record. The `ExternalIdentity` model maps one contact to multiple source-specific identifiers across systems (email, phone, LinkedIn URL, Telegram handle, etc.). Each identity has a `source`, `externalId`, `confidence` score, and optional `rawData` from the source.

## Provenance model

The `ContactFieldProvenance` model tracks source attribution for individual field values on a contact. Each field change records which source wrote it, with what confidence, and who (user or agent) triggered the change. The `isActive` flag indicates the current "winning" value.

## External content references

The `ExternalRecord` model is the generic container for external relationship content and references. It stores links, short snippets, transcripts, and other curated artifacts with source, kind, optional external ID, optional URL, optional content, and happened-at time. This lets Monica preserve important context from systems like email, Telegram, LinkedIn, Zoom, phone calls, Todoist, and Notion without treating Monica as the raw source-of-truth system for those platforms.

## Golden record concept

A golden record is one canonical contact merged from multiple source records. The `ContactMergeLog` model tracks merge/unmerge operations with full audit detail: which fields were taken from which contact, who approved the merge, and whether it was automatic or manual.

## Dedup / merge principles

- Use deterministic rules where possible
- Ask for human confirmation when confidence is not enough
- Keep merges reversible whenever the domain allows it

## Current schema

- 79 Prisma models (75 core + 4 golden record: ExternalIdentity, ExternalRecord, ContactMergeLog, ContactFieldProvenance)
- 2 enums
- Central axis: `Account → User → Vault → Contact`

## Key design decisions

- UUID primary keys are used for core records.
- Contact uses soft deletes.
- Data is scoped to a vault unless a model is intentionally global.
