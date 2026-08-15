# Glossary

- **Golden record** — The canonical, merged view of a contact stored in AygaCRM. It is the best current representation of a person after deduplication, enrichment, and conflict resolution.
- **Contact** — The primary CRM entity that AygaCRM manages. A contact represents the canonical relationship record, not just a raw source entry.
- **Person** — A real-world human being. A person may appear in AygaCRM through multiple sources, but AygaCRM stores one contact as the canonical record for that person when possible.
- **Identity** — The set of attributes that uniquely or strongly identify a person, such as name, handles, phone numbers, emails, or external IDs.
- **Profile** — A source-specific or user-facing representation of a contact, often containing partial data from one platform or system.
- **Source** — An external system or record that contributes data to AygaCRM, such as email, Telegram, LinkedIn, or phone logs.
- **Provenance** — Metadata that records where a value came from, when it was observed, and how it entered the system.
- **Enrichment** — The process of adding or improving contact data using external sources, user input, or agent actions.
- **Merge / dedupe** — The process of deciding that multiple records refer to the same person and combining them into one canonical contact.
- **Interaction** — Any recorded communication or touchpoint with a contact, such as an email, call, meeting, note, or message.
- **Timeline** — The chronological history of interactions, source events, notes, and relationship changes for a contact.
- **Agent** — A non-human actor that uses AygaCRM through API, CLI, or MCP to read data, enrich contacts, or perform controlled writes.
- **Integration** — A connector that syncs data between AygaCRM and an external system or ecosystem app.
- **Vault** — The top-level data boundary for a user’s CRM data. Vault-scoped data belongs to one logical store of contacts and related records.
- **Account** — The authentication and ownership boundary for a user or organization. In this codebase, Account is the central axis above User, Vault, and Contact.
