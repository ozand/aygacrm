# Integration Roadmap

## Source ingestion priority

1. **Email** — highest value because it contains the most communication data.
2. **Telegram** — high usage and practical API access.
3. **LinkedIn** — strong for professional contacts and enrichment.
4. **Phone / call transcripts** — important relationship history.
5. **Zoom / meeting transcripts** — useful relationship context and decisions.
6. **WhatsApp** — useful, but API access is limited.
7. **VK**
8. **Facebook**

## External context priority

1. **Todoist** — task sync
2. **Notion** — workspace context
3. **Obsidian / Logseq** — knowledge base context

## Integration pattern

Each source-aware ingestion adapter should follow the same basic path: source capture agent → normalization → AygaCRM write.

The adapter or external agent is responsible for collecting data from the source. Normalization turns source-specific content into AygaCRM’s internal shape. AygaCRM then stores the curated reference, content, and provenance against the canonical contact.

## Direction

These are ingestion contracts, not native OAuth/webhook/polling connectors. AygaCRM should define the storage and write interfaces; external systems should handle source authentication, data collection, and source-specific extraction.

## Ingestion conventions

Standardized source/kind pairs, metadata schemas, and validation rules are defined in `ingestion-conventions.md` and enforced across all write interfaces (API v1, MCP, CLI, UI).

Source of truth: `app/src/lib/ingestion-conventions.ts`

## Documentation rule

Each integration gets its own implementation doc when work starts. Until then, this roadmap is the source of priority order and expected direction.

## Implemented adapters

- **Telegram** — external ingestion adapter, see [`telegram.md`](telegram.md).
