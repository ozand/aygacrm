# AygaCRM Documentation

AygaCRM is a rewrite of the Monica relationship app on Next.js 16, React 19, Prisma 7, and PostgreSQL. This codebase is building a relationship intelligence platform whose job is to maintain a canonical contact hub: a golden record for each person, with communication memory, provenance, and integration data from external systems.

## Documentation map

- [Glossary](./glossary.md) — project terms used across product, architecture, and backlog docs.
- Product
  - [Vision](./product/vision.md)
  - [Principles](./product/principles.md)
  - [Scope](./product/scope.md)
- Architecture
  - [Overview](./architecture/overview.md)
  - [Data model](./architecture/data-model.md)
  - [Agent access](./architecture/agent-access.md)
- Integrations
  - [Roadmap](./integrations/roadmap.md)
- Deployment
  - [Docker](./deployment/docker.md)
- Process
  - [Definition of Ready](./process/definition-of-ready.md)
  - [Definition of Done](./process/definition-of-done.md)
- Backlog
  - [Backlog rules](./backlog/README.md)
- Templates
  - [Epic template](./templates/epic-template.md)
  - [Feature template](./templates/feature-template.md)
  - [Task template](./templates/task-template.md)
  - [ADR template](./templates/adr-template.md)

## How to use these docs

Use the docs as a traceable chain of intent: every task links to a feature, every feature links to an epic, and every epic links back to product vision, principles, and architecture. If a change cannot be tied to that chain, it is not ready to implement.

## Ownership

These documents are living project assets. They evolve through pull requests just like code, and changes to product behavior, architecture, or process should update the relevant docs in the same review.
