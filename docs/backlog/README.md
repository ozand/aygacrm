# Backlog System Rules

## Hierarchy

Epic → Feature → Task

## ID convention

- `EPIC-NNNN`
- `FEAT-NNNN`
- `TASK-NNNN`

## Linking rules

- Every task MUST link to a parent feature.
- Every feature MUST link to a parent epic.
- Every epic MUST link to vision, principles, and architecture docs.

## Implementation rule

Agents should only implement what is written. If a piece of work is not linked and described, it is not authorized for implementation.

## States

- draft
- ready
- in-progress
- done
- cancelled

## Missing requirement rule

If a requirement is missing, stop and record it. Do not fill gaps with assumptions.
