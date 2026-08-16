/**
 * Pure mapping from Telegram Bot API `getUpdates` results to the ingest
 * request body consumed by `POST /api/v1/ingest` (see docs/api/openapi.json
 * and src/lib/ingest/ingest.ts). No I/O, no Telegram/AygaCRM client calls —
 * this is the testable core of the adapter (issue #27).
 */

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramChat {
  id: number;
  title?: string;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  /** Unix seconds. */
  date: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramContactHints {
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramIngestMetadata {
  chatId: number;
  chatTitle?: string;
  messageId: number;
  username?: string;
  direction: "inbound";
}

/** Wire body accepted by POST /api/v1/ingest (snake_case per that contract). */
export interface IngestRequestBody {
  source: "telegram";
  kind: "message";
  /** The source identity (maps to ExternalIdentity.externalId). */
  handle: string;
  external_id: string;
  content: string;
  metadata: TelegramIngestMetadata;
  happened_at: string;
  contact_hints?: TelegramContactHints;
}

/**
 * Maps one Telegram `getUpdates` result to an ingest request body, or `null`
 * if the update should be skipped: no `message`, no `message.text` (e.g.
 * photos/stickers/service messages), or no `message.from` (e.g. anonymous
 * channel posts, which have no stable per-user identity to resolve a contact
 * against).
 */
export function telegramUpdateToIngest(update: TelegramUpdate): IngestRequestBody | null {
  const message = update.message;
  if (!message || !message.text || !message.from) {
    return null;
  }

  const { from, chat } = message;
  const handle = from.username ?? String(from.id);

  const contactHints: TelegramContactHints = {};
  if (from.first_name) contactHints.first_name = from.first_name;
  if (from.last_name) contactHints.last_name = from.last_name;
  if (from.username) contactHints.username = from.username;

  const metadata: TelegramIngestMetadata = {
    chatId: chat.id,
    messageId: message.message_id,
    direction: "inbound",
  };
  if (chat.title) metadata.chatTitle = chat.title;
  if (from.username) metadata.username = from.username;

  return {
    source: "telegram",
    kind: "message",
    handle,
    // message_id is only unique per-chat; scope it by chat for global
    // uniqueness so the same message_id in different chats never collides.
    external_id: `${chat.id}:${message.message_id}`,
    content: message.text,
    metadata,
    happened_at: new Date(message.date * 1000).toISOString(),
    ...(Object.keys(contactHints).length > 0 ? { contact_hints: contactHints } : {}),
  };
}
