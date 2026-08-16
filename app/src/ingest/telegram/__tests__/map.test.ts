import { describe, expect, it } from "vitest";
import { telegramUpdateToIngest, type TelegramUpdate } from "@/ingest/telegram/map";

function baseUpdate(overrides: Partial<TelegramUpdate> = {}): TelegramUpdate {
  return {
    update_id: 100,
    message: {
      message_id: 42,
      date: 1700000000, // 2023-11-14T22:13:20.000Z
      text: "hello there",
      from: { id: 555, username: "alice", first_name: "Alice", last_name: "Anders" },
      chat: { id: -1001234, title: "Project Chat", type: "group" },
    },
    ...overrides,
  };
}

describe("telegramUpdateToIngest", () => {
  it("maps a text message to the ingest request body", () => {
    const result = telegramUpdateToIngest(baseUpdate());

    expect(result).toEqual({
      source: "telegram",
      kind: "message",
      handle: "alice",
      external_id: "-1001234:42",
      content: "hello there",
      metadata: {
        chatId: -1001234,
        chatTitle: "Project Chat",
        messageId: 42,
        username: "alice",
        direction: "inbound",
      },
      happened_at: "2023-11-14T22:13:20.000Z",
      contact_hints: {
        first_name: "Alice",
        last_name: "Anders",
        username: "alice",
      },
    });
  });

  it("falls back to the numeric id as the handle when there is no username", () => {
    const update = baseUpdate({
      message: {
        message_id: 7,
        date: 1700000000,
        text: "no username here",
        from: { id: 999 },
        chat: { id: 111, type: "private" },
      },
    });

    const result = telegramUpdateToIngest(update);

    expect(result?.handle).toBe("999");
    expect(result?.metadata.username).toBeUndefined();
    // No first_name/last_name/username hints at all -> contact_hints omitted.
    expect(result?.contact_hints).toBeUndefined();
  });

  it("composes external_id from chat id and message id (message_id is only unique per-chat)", () => {
    const a = telegramUpdateToIngest(
      baseUpdate({
        message: {
          message_id: 1,
          date: 1700000000,
          text: "hi",
          from: { id: 1 },
          chat: { id: 10, type: "private" },
        },
      })
    );
    const b = telegramUpdateToIngest(
      baseUpdate({
        message: {
          message_id: 1,
          date: 1700000000,
          text: "hi",
          from: { id: 1 },
          chat: { id: 20, type: "private" },
        },
      })
    );

    expect(a?.external_id).toBe("10:1");
    expect(b?.external_id).toBe("20:1");
    expect(a?.external_id).not.toBe(b?.external_id);
  });

  it("converts the unix-seconds date to an ISO 8601 string with offset", () => {
    const result = telegramUpdateToIngest(baseUpdate());
    expect(result?.happened_at).toBe(new Date(1700000000 * 1000).toISOString());
    expect(result?.happened_at).toMatch(/Z$/);
  });

  it("omits absent contact_hints fields rather than including them as undefined", () => {
    const update = baseUpdate({
      message: {
        message_id: 2,
        date: 1700000000,
        text: "just a username",
        from: { id: 42, username: "bob" },
        chat: { id: 1, type: "private" },
      },
    });

    const result = telegramUpdateToIngest(update);

    expect(result?.contact_hints).toEqual({ username: "bob" });
    expect(Object.keys(result?.contact_hints ?? {})).not.toContain("first_name");
    expect(Object.keys(result?.contact_hints ?? {})).not.toContain("last_name");
  });

  it("skips updates with no message", () => {
    const update: TelegramUpdate = { update_id: 1 };
    expect(telegramUpdateToIngest(update)).toBeNull();
  });

  it("skips updates whose message has no text (e.g. photo/sticker/service messages)", () => {
    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 5,
        date: 1700000000,
        from: { id: 1, username: "alice" },
        chat: { id: 1, type: "private" },
      },
    };
    expect(telegramUpdateToIngest(update)).toBeNull();
  });

  it("skips updates with no sender (e.g. anonymous channel posts)", () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 6,
        date: 1700000000,
        text: "anonymous post",
        chat: { id: 1, type: "channel" },
      },
    };
    expect(telegramUpdateToIngest(update)).toBeNull();
  });
});
