# Data Model Principles

## Core entities

- **Account** — authentication and ownership boundary.
- **User** — the signed-in person associated with an account.
- **Vault** — the scoped CRM container that holds a user’s data boundary.
- **Contact** — the canonical relationship record for a person.

## Identity model

Contact is the canonical record. The schema will gain an `ExternalIdentity` model to map one contact to multiple source-specific identifiers across systems.

## Provenance model

The future provenance model will attach source attribution to individual field values and can include confidence scoring where useful. Provenance should answer both “where did this come from?” and “how sure are we?”

## Golden record concept

A golden record is one canonical contact merged from multiple source records. It should keep the best current truth while still preserving source history and conflict detail.

## Dedup / merge principles

- Use deterministic rules where possible
- Ask for human confirmation when confidence is not enough
- Keep merges reversible whenever the domain allows it

## Current schema

- 75 Prisma models
- 2 enums
- Central axis: `Account → User → Vault → Contact`

## Key design decisions

- UUID primary keys are used for core records.
- Contact uses soft deletes.
- Data is scoped to a vault unless a model is intentionally global.
