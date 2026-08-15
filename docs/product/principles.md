# Product Principles

These principles are non-negotiable. If a feature conflicts with them, the feature must change.

## Provenance is mandatory

Every field value must be traceable to a source and timestamp. If AygaCRM cannot explain where a value came from, it should not present that value as trusted truth.

## Human override wins

When a user manually edits a field, that decision takes priority over connector churn. A human choice can lock a field until the user changes it again.

## Agents must be auditable

Every write made by an agent must be traceable to the actor, action, timestamp, and affected records. Silent autonomous changes are not acceptable.

## No silent overwrite

Manual edits must never be replaced by source data without an explicit rule or user decision. Incoming updates should surface conflicts instead of hiding them.

## Raw is immutable

External events are append-only facts. AygaCRM may transform, summarize, or merge them, but it should not mutate the original event history.

## AygaCRM owns contact truth

The canonical identity for a contact lives in AygaCRM. Other systems can contribute data, but AygaCRM is the place where contact truth is resolved.

## Product simplicity

Prefer working features over comprehensive stubs. Do not overengineer abstractions, workflows, or integrations before the real need is clear.
