# Scope

## In scope

- Contact CRUD
- Timeline
- Notes
- Activities
- Reminders
- Tasks
- Calls
- Relationships
- Companies
- Groups
- Labels
- Files / photos
- Journal
- Search
- Settings
- API
- Agent access
- Source integrations
- Golden record engine

## Out of scope

- Task management — handled by Todoist
- Project management — handled by Notion
- Knowledge graphs — handled by Obsidian / Logseq
- Email client
- Messaging client

## Explicitly deferred

- CardDAV sync
- WebAuthn
- Multi-vault
- Advanced reports

## Assumptions

- PostgreSQL is the primary database
- Initial deployment is single-server
- pnpm is the package manager

## Open questions

- Storage strategy for uploaded files: local disk or S3 is still to be decided.
- Summarization approach for timelines and long histories is still to be decided.
