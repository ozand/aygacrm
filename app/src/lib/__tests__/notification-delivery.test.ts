import { vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { beforeEach, describe, expect, it } from "vitest";
import { reminderDaysBefore, isReminderDue } from "@/lib/notifications/deliver";
import { sendToChannel } from "@/lib/notifications/transport";

describe("reminderDaysBefore", () => {
  it("maps 'day' to 1", () => {
    expect(reminderDaysBefore("day", 99)).toBe(1);
  });

  it("maps 'week' to 7", () => {
    expect(reminderDaysBefore("week", 99)).toBe(7);
  });

  it("maps 'month' to 30", () => {
    expect(reminderDaysBefore("month", 99)).toBe(30);
  });

  it("returns numberOfDaysBefore for custom choice", () => {
    expect(reminderDaysBefore("custom", 5)).toBe(5);
  });

  it("returns numberOfDaysBefore for unknown choice", () => {
    expect(reminderDaysBefore("whatever", 3)).toBe(3);
  });

  it("returns 0 for unknown choice with 0 days", () => {
    expect(reminderDaysBefore("whatever", 0)).toBe(0);
  });
});

describe("isReminderDue", () => {
  it("is due today for an event tomorrow with 'day' choice", () => {
    const now = new Date(2026, 5, 10); // Jun 10, 2026
    const reminder = {
      reminderChoice: "day",
      numberOfDaysBefore: 0,
      importantDate: { day: 11, month: 6 },
    };
    expect(isReminderDue(reminder, now)).toBe(true);
  });

  it("is due today for an event in 7 days with 'week' choice", () => {
    const now = new Date(2026, 5, 10); // Jun 10, 2026
    const reminder = {
      reminderChoice: "week",
      numberOfDaysBefore: 0,
      importantDate: { day: 17, month: 6 },
    };
    expect(isReminderDue(reminder, now)).toBe(true);
  });

  it("is not due one day earlier for the same 'week' reminder", () => {
    const now = new Date(2026, 5, 9); // Jun 9, 2026
    const reminder = {
      reminderChoice: "week",
      numberOfDaysBefore: 0,
      importantDate: { day: 17, month: 6 },
    };
    expect(isReminderDue(reminder, now)).toBe(false);
  });

  it("is due today for an event today with custom 0 days", () => {
    const now = new Date(2026, 5, 10); // Jun 10, 2026
    const reminder = {
      reminderChoice: "custom",
      numberOfDaysBefore: 0,
      importantDate: { day: 10, month: 6 },
    };
    expect(isReminderDue(reminder, now)).toBe(true);
  });

  it("handles year wrap: Dec 30 trigger for Jan 5 event with 6 days before", () => {
    const now = new Date(2026, 11, 30); // Dec 30, 2026
    const reminder = {
      reminderChoice: "custom",
      numberOfDaysBefore: 6,
      importantDate: { day: 5, month: 1 },
    };
    expect(isReminderDue(reminder, now)).toBe(true);
  });

  it("returns false when month is null", () => {
    const now = new Date(2026, 5, 10);
    const reminder = {
      reminderChoice: "day",
      numberOfDaysBefore: 0,
      importantDate: { day: 11, month: null },
    };
    expect(isReminderDue(reminder, now)).toBe(false);
  });

  it("returns false when day is null", () => {
    const now = new Date(2026, 5, 10);
    const reminder = {
      reminderChoice: "day",
      numberOfDaysBefore: 0,
      importantDate: { day: null, month: 6 },
    };
    expect(isReminderDue(reminder, now)).toBe(false);
  });

  it("returns false for a clearly not-due date", () => {
    const now = new Date(2026, 5, 10); // Jun 10, 2026
    const reminder = {
      reminderChoice: "day",
      numberOfDaysBefore: 0,
      importantDate: { day: 25, month: 9 },
    };
    expect(isReminderDue(reminder, now)).toBe(false);
  });
});

describe("sendToChannel", () => {
  beforeEach(() => {
    delete process.env.SMTP_URL;
    delete process.env.SMTP_FROM;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("fails for email when SMTP_URL is not configured", async () => {
    const result = await sendToChannel(
      { type: "email", content: "a@b.c" },
      "Subject",
      "Body"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SMTP_URL");
  });

  it("fails for telegram when TELEGRAM_BOT_TOKEN is not configured", async () => {
    const result = await sendToChannel(
      { type: "telegram", content: "12345" },
      "Subject",
      "Body"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("fails for an unknown channel type", async () => {
    const result = await sendToChannel(
      { type: "pigeon", content: "roof" },
      "Subject",
      "Body"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsupported");
  });
});
