# Integration Roadmap

## Source integration priority

1. **Email** — highest value because it contains the most communication data.
2. **Telegram** — high usage and practical API access.
3. **LinkedIn** — strong for professional contacts and enrichment.
4. **Phone / call logs** — important relationship history.
5. **WhatsApp** — useful, but API access is limited.
6. **VK**
7. **Facebook**

## Ecosystem sync priority

1. **Todoist** — task sync
2. **Notion** — workspace context
3. **Obsidian / Logseq** — knowledge base context

## Integration pattern

Each connector should follow the same basic path: connector service → normalization → golden record update.

The connector is responsible for fetching source data. Normalization turns source-specific data into Monica’s internal shape. The golden record engine then decides how the data affects the canonical contact.

## Documentation rule

Each integration gets its own implementation doc when work starts. Until then, this roadmap is the source of priority order and expected direction.
