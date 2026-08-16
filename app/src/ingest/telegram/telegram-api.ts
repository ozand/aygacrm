/**
 * Thin fetch wrapper over the Telegram Bot API's `getUpdates` long-poll
 * endpoint (https://core.telegram.org/bots/api#getupdates). This is the only
 * Telegram-side network call this adapter makes — no Telegram SDK, just
 * global `fetch` (Node 18+).
 */

import type { TelegramUpdate } from "./map";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface GetUpdatesOptions {
  /** update_id of the first update to return; omit to start from the beginning. */
  offset?: number;
  /** Long-poll timeout in seconds. Defaults to 30. */
  timeout?: number;
  /** Aborts the in-flight long-poll request (used for graceful shutdown). */
  signal?: AbortSignal;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

/**
 * Long-polls Telegram for new updates starting at `offset`. Resolves with the
 * `result` array (empty if the poll times out with no new updates). Throws
 * an `Error` carrying Telegram's `description` when the API responds with
 * `ok: false` or a non-2xx HTTP status; throws the underlying `AbortError`
 * unmodified when `signal` is aborted, so callers can distinguish a deliberate
 * shutdown from a real failure.
 */
export async function getUpdates(token: string, options: GetUpdatesOptions = {}): Promise<TelegramUpdate[]> {
  const params = new URLSearchParams();
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  params.set("timeout", String(options.timeout ?? 30));

  const url = `${TELEGRAM_API_BASE}/bot${token}/getUpdates?${params.toString()}`;

  const response = await fetch(url, { signal: options.signal });

  let json: TelegramApiResponse | null = null;
  try {
    json = (await response.json()) as TelegramApiResponse;
  } catch {
    json = null;
  }

  if (!response.ok || !json?.ok) {
    const description = json?.description ?? `HTTP ${response.status}`;
    throw new Error(`Telegram getUpdates failed: ${description}`);
  }

  return json.result ?? [];
}
