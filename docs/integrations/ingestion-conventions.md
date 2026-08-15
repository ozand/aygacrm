# Ingestion Conventions

## Overview

External records in AygaCRM follow standardized **source/kind** pairs with optional typed metadata. All ingestion — whether via API, MCP, CLI, or UI — validates against these conventions.

Source of truth: `app/src/lib/ingestion-conventions.ts`

---

## Sources

| Source      | Label       | Description                                  |
|-------------|-------------|----------------------------------------------|
| `email`     | Email       | Email threads, snippets, references          |
| `telegram`  | Telegram    | Messages, profiles, curated context          |
| `linkedin`  | LinkedIn    | Profiles, professional context               |
| `todoist`   | Todoist     | Task references                              |
| `notion`    | Notion      | Pages, project references                    |
| `zoom`      | Zoom        | Meeting transcripts, recordings              |
| `phone`     | Phone       | Call transcripts                             |
| `whatsapp`  | WhatsApp    | Messages, media references                   |
| `manual`    | Manual      | Human-entered records (accepts all kinds)    |
| `other`     | Other       | Uncategorized (accepts all kinds)            |

## Kinds

| Kind         | Label        | Description                                 |
|--------------|--------------|---------------------------------------------|
| `message`    | Message      | Single message or chat snippet              |
| `thread`     | Thread       | Email thread or conversation thread         |
| `profile`    | Profile      | Contact profile snapshot                    |
| `note`       | Note         | Free-form note or summary                   |
| `transcript` | Transcript   | Call or meeting transcript                   |
| `task`       | Task         | Task or to-do reference                     |
| `page`       | Page         | Document or wiki page                        |
| `meeting`    | Meeting      | Meeting record (agenda, notes, action items) |
| `reference`  | Reference    | Generic link or external reference           |
| `snippet`    | Snippet      | Short extract or quote                       |

## Valid Source → Kind Combinations

| Source    | Valid Kinds                                        |
|-----------|----------------------------------------------------|
| email     | message, thread, snippet, reference                |
| telegram  | message, profile, snippet, reference               |
| linkedin  | profile, note, reference                           |
| todoist   | task, reference                                    |
| notion    | page, note, reference                              |
| zoom      | meeting, transcript, reference                     |
| phone     | transcript, reference                              |
| whatsapp  | message, snippet, reference                        |
| manual    | *(all kinds)*                                      |
| other     | *(all kinds)*                                      |

Invalid combinations are rejected at validation time.

---

## Metadata Schemas

Each source has an optional typed metadata schema. Metadata is validated when provided but not required.

### Email
```json
{
  "messageId": "string (optional) — RFC 5322 Message-ID",
  "threadId": "string (optional) — thread grouping ID",
  "from": "string (optional) — sender address",
  "to": "string[] (optional) — recipient addresses",
  "cc": "string[] (optional) — CC addresses",
  "subject": "string (optional) — email subject",
  "folder": "string (optional) — mailbox folder"
}
```

### Telegram
```json
{
  "chatId": "string (optional) — Telegram chat ID",
  "messageId": "number (optional) — message sequence number",
  "username": "string (optional) — @username",
  "chatTitle": "string (optional) — group/channel title"
}
```

### LinkedIn
```json
{
  "profileUrl": "string (optional) — LinkedIn profile URL",
  "headline": "string (optional) — professional headline",
  "company": "string (optional) — current company",
  "position": "string (optional) — current position",
  "connectionDegree": "number (optional) — 1st/2nd/3rd"
}
```

### Todoist
```json
{
  "projectId": "string (optional) — Todoist project ID",
  "projectName": "string (optional) — project name",
  "priority": "number (optional) — 1-4 priority level",
  "dueDate": "string (optional) — ISO date string",
  "labels": "string[] (optional) — task labels",
  "completed": "boolean (optional) — completion status"
}
```

### Notion
```json
{
  "pageId": "string (optional) — Notion page ID",
  "databaseId": "string (optional) — parent database ID",
  "workspaceName": "string (optional) — workspace name",
  "icon": "string (optional) — page icon emoji or URL",
  "parentType": "string (optional) — page/database/workspace"
}
```

### Zoom
```json
{
  "meetingId": "string (optional) — Zoom meeting ID",
  "duration": "number (optional) — duration in minutes",
  "participants": "string[] (optional) — participant names/emails",
  "recordingUrl": "string (optional) — recording URL",
  "meetingType": "string (optional) — instant/scheduled/recurring"
}
```

### Phone
```json
{
  "phoneNumber": "string (optional) — phone number",
  "direction": "'inbound' | 'outbound' (optional)",
  "duration": "number (optional) — duration in seconds",
  "provider": "string (optional) — VoIP/carrier name"
}
```

### WhatsApp
```json
{
  "chatId": "string (optional) — WhatsApp chat ID",
  "messageId": "string (optional) — message ID",
  "phoneNumber": "string (optional) — phone number",
  "groupName": "string (optional) — group name",
  "mediaType": "string (optional) — image/video/audio/document"
}
```

### Generic (manual, other)
Any `Record<string, unknown>` is accepted.

---

## Write Interfaces

External records can be created through 4 channels:

### 1. API v1 — `POST /api/v1/records`

```bash
curl -X POST https://aygacrm.example/api/v1/records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "uuid",
    "source": "telegram",
    "kind": "message",
    "title": "Discussion about project timeline",
    "content": "Key decisions from Telegram chat...",
    "url": "https://t.me/c/12345/678",
    "happenedAt": "2025-03-15T14:30:00Z",
    "metadata": {
      "chatId": "12345",
      "messageId": 678,
      "username": "johndoe"
    }
  }'
```

Response: `201 Created` with the created record.

### 2. MCP — `aygacrm_add_record`

```json
{
  "tool": "aygacrm_add_record",
  "arguments": {
    "contactId": "uuid",
    "source": "email",
    "kind": "thread",
    "title": "Re: Q4 Planning",
    "content": "Thread summary...",
    "happenedAt": "2025-03-10T09:00:00Z",
    "metadata": {
      "subject": "Q4 Planning",
      "from": "alice@example.com",
      "threadId": "thread-abc-123"
    }
  }
}
```

### 3. CLI — `records add`

```bash
pnpm exec tsx src/cli/aygacrm-cli.ts records add <contactId> \
  --source todoist \
  --kind task \
  --title "Follow up on proposal" \
  --url "https://todoist.com/showTask?id=123"
```

Note: CLI does not currently support `--metadata` (use API or MCP for metadata).

### 4. UI — Contact Detail Page

The external records card on the contact detail page provides dropdown selects for source and kind (dynamically filtered based on valid combinations).

---

## Validation Rules

1. **Source** must be one of the 10 defined sources
2. **Kind** must be one of the 10 defined kinds
3. **Source/kind combination** must be valid per the mapping table
4. **At least one** of `title`, `content`, `url`, or `externalId` must be provided
5. **Metadata** (if provided) is validated against the source-specific schema
6. **happenedAt** (if provided) must be a valid ISO 8601 datetime

All channels (API, MCP, CLI, server actions, UI) enforce these rules consistently.

---

## Agent Ingestion Pattern

The recommended pattern for agent-driven ingestion:

1. Agent connects to source (email inbox, Telegram API, etc.)
2. Agent extracts relevant content and normalizes it
3. Agent looks up or creates the contact in AygaCRM (via API/MCP)
4. Agent writes one or more `ExternalRecord` entries with proper source/kind/metadata
5. AygaCRM stores the curated reference with provenance

AygaCRM is the **storage and display layer**. Agents own source authentication, data extraction, and normalization. AygaCRM defines the contract; agents fulfill it.
