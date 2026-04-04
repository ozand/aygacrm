import { describe, expect, it } from "vitest";
import {
  createExternalRecordSchema,
  updateExternalRecordSchema,
  validateMetadata,
} from "@/lib/ingestion-conventions";

describe("API v1 records validation", () => {
  describe("createExternalRecordSchema", () => {
    it("accepts valid payloads for each source type", () => {
      const validPayloads = [
        {
          contactId: "contact_1",
          source: "email",
          kind: "message",
          title: "Email message",
          metadata: { direction: "inbound", from: "sender@example.com" },
        },
        {
          contactId: "contact_1",
          source: "telegram",
          kind: "message",
          content: "Hello from Telegram",
          metadata: { chatId: 12345, direction: "outbound" },
        },
        {
          contactId: "contact_1",
          source: "linkedin",
          kind: "profile",
          externalId: "li_123",
          metadata: { profileUrl: "https://www.linkedin.com/in/jane-doe" },
        },
        {
          contactId: "contact_1",
          source: "todoist",
          kind: "task",
          title: "Follow up",
          metadata: { priority: 4, completed: false },
        },
        {
          contactId: "contact_1",
          source: "notion",
          kind: "page",
          url: "https://www.notion.so/workspace/page",
          metadata: { pageId: "page_1", status: "In Progress" },
        },
        {
          contactId: "contact_1",
          source: "zoom",
          kind: "meeting",
          title: "Weekly sync",
          metadata: { meetingId: "zoom_1", recordingUrl: "https://zoom.us/rec/abc" },
        },
        {
          contactId: "contact_1",
          source: "phone",
          kind: "transcript",
          content: "Call transcript",
          metadata: { phoneNumber: "+12025550123", direction: "inbound" },
        },
        {
          contactId: "contact_1",
          source: "whatsapp",
          kind: "message",
          content: "WhatsApp message",
          metadata: { chatId: "chat_1", direction: "outbound" },
        },
        {
          contactId: "contact_1",
          source: "manual",
          kind: "note",
          title: "Manual note",
          metadata: { any: "value", nested: { ok: true } },
        },
        {
          contactId: "contact_1",
          source: "other",
          kind: "reference",
          title: "Other reference",
          metadata: { provider: "custom", score: 0.8 },
        },
      ];

      for (const payload of validPayloads) {
        const result = createExternalRecordSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid source/kind combinations", () => {
      const result = createExternalRecordSchema.safeParse({
        contactId: "contact_1",
        source: "todoist",
        kind: "meeting",
        title: "Invalid pair",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message === "Invalid source/kind combination")).toBe(true);
      }
    });

    it("rejects missing required fields", () => {
      const missingContactId = createExternalRecordSchema.safeParse({
        source: "email",
        kind: "message",
        title: "Missing contact",
      });

      const missingContentFields = createExternalRecordSchema.safeParse({
        contactId: "contact_1",
        source: "email",
        kind: "message",
      });

      expect(missingContactId.success).toBe(false);
      expect(missingContentFields.success).toBe(false);

      if (!missingContentFields.success) {
        expect(
          missingContentFields.error.issues.some(
            (issue) => issue.message === "At least one of url, title, content, or externalId is required"
          )
        ).toBe(true);
      }
    });
  });

  describe("updateExternalRecordSchema", () => {
    it("allows partial updates", () => {
      expect(updateExternalRecordSchema.safeParse({ title: "Updated title" }).success).toBe(true);
      expect(updateExternalRecordSchema.safeParse({ metadata: { provider: "gmail" } }).success).toBe(true);
      expect(updateExternalRecordSchema.safeParse({ happenedAt: "2026-04-01T10:15:00+00:00" }).success).toBe(true);
      expect(updateExternalRecordSchema.safeParse({}).success).toBe(true);
    });

    it("rejects invalid source/kind combinations when both are provided", () => {
      const result = updateExternalRecordSchema.safeParse({
        source: "phone",
        kind: "message",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message === "Invalid source/kind combination")).toBe(true);
      }
    });
  });

  describe("source-specific metadata validation", () => {
    it("validates metadata per source type", () => {
      const validCases: Array<{ source: Parameters<typeof validateMetadata>[0]; metadata: unknown }> = [
        { source: "email", metadata: { direction: "inbound", to: ["a@example.com"] } },
        { source: "telegram", metadata: { chatId: "chat_1", messageId: 42 } },
        { source: "linkedin", metadata: { profileUrl: "https://www.linkedin.com/in/john-doe" } },
        { source: "todoist", metadata: { priority: 2, labels: ["crm"] } },
        { source: "notion", metadata: { pageId: "pg_1", workspaceName: "Monica" } },
        { source: "zoom", metadata: { recordingUrl: "https://zoom.us/rec/xyz", duration: 30 } },
        { source: "phone", metadata: { direction: "outbound", duration: 120 } },
        { source: "whatsapp", metadata: { phoneNumber: "+12025550123", direction: "inbound" } },
        { source: "manual", metadata: { anything: { goes: true } } },
        { source: "other", metadata: { custom: [1, 2, 3] } },
      ];

      for (const { source, metadata } of validCases) {
        const result = validateMetadata(source, metadata);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid metadata for constrained sources", () => {
      const linkedinResult = validateMetadata("linkedin", { profileUrl: "not-a-url" });
      const todoistResult = validateMetadata("todoist", { priority: 9 });
      const whatsappResult = validateMetadata("whatsapp", { direction: "sideways" });

      expect(linkedinResult.success).toBe(false);
      expect(todoistResult.success).toBe(false);
      expect(whatsappResult.success).toBe(false);
    });
  });
});
