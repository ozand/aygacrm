import { describe, it, expect } from "vitest";
import {
  KINDS,
  SOURCES,
  createExternalRecordSchema,
  getValidKindsForSource,
  isValidSourceKind,
  kindSchema,
  sourceSchema,
  updateExternalRecordSchema,
  validateMetadata,
} from "@/lib/ingestion-conventions";

describe("SOURCES and KINDS", () => {
  it("has the expected source values", () => {
    expect(SOURCES).toHaveLength(10);
    expect(SOURCES).toEqual([
      "email",
      "telegram",
      "linkedin",
      "todoist",
      "notion",
      "zoom",
      "phone",
      "whatsapp",
      "manual",
      "other",
    ]);
  });

  it("has the expected kind values", () => {
    expect(KINDS).toHaveLength(10);
    expect(KINDS).toEqual([
      "message",
      "thread",
      "profile",
      "note",
      "transcript",
      "task",
      "page",
      "meeting",
      "reference",
      "snippet",
    ]);
  });
});

describe("sourceSchema and kindSchema", () => {
  it("accepts valid source and kind values", () => {
    expect(sourceSchema.safeParse("email").success).toBe(true);
    expect(kindSchema.safeParse("task").success).toBe(true);
  });

  it("rejects invalid source and kind values", () => {
    expect(sourceSchema.safeParse("slack").success).toBe(false);
    expect(kindSchema.safeParse("call").success).toBe(false);
  });
});

describe("isValidSourceKind", () => {
  it("returns true for valid combinations", () => {
    expect(isValidSourceKind("email", "message")).toBe(true);
    expect(isValidSourceKind("todoist", "task")).toBe(true);
  });

  it("returns false for invalid combinations", () => {
    expect(isValidSourceKind("todoist", "transcript")).toBe(false);
    expect(isValidSourceKind("phone", "message")).toBe(false);
  });

  it("allows all kinds for manual and other", () => {
    for (const kind of KINDS) {
      expect(isValidSourceKind("manual", kind)).toBe(true);
      expect(isValidSourceKind("other", kind)).toBe(true);
    }
  });
});

describe("createExternalRecordSchema", () => {
  it("accepts a valid record", () => {
    const result = createExternalRecordSchema.safeParse({
      contactId: "contact_123",
      source: "email",
      kind: "message",
      title: "Follow-up",
      content: "Thanks for your time today.",
      url: "https://example.com/message/1",
      externalId: "msg_1",
      happenedAt: "2026-04-01T10:15:00+00:00",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing contactId", () => {
    const result = createExternalRecordSchema.safeParse({
      source: "email",
      kind: "message",
      title: "Hello",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when all required content identifiers are missing", () => {
    const result = createExternalRecordSchema.safeParse({
      contactId: "contact_123",
      source: "email",
      kind: "message",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("At least one of url, title, content, or externalId is required"))).toBe(true);
    }
  });

  it("rejects invalid source/kind combinations", () => {
    const result = createExternalRecordSchema.safeParse({
      contactId: "contact_123",
      source: "todoist",
      kind: "transcript",
      title: "Invalid pair",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Invalid source/kind combination"))).toBe(true);
    }
  });

  it("accepts valid source-specific metadata", () => {
    const result = createExternalRecordSchema.safeParse({
      contactId: "contact_123",
      source: "linkedin",
      kind: "profile",
      title: "Prospect profile",
      metadata: {
        profileUrl: "https://www.linkedin.com/in/jane-doe",
        headline: "Head of Sales",
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("updateExternalRecordSchema", () => {
  it("accepts partial updates", () => {
    expect(updateExternalRecordSchema.safeParse({ title: "Updated title" }).success).toBe(true);
    expect(updateExternalRecordSchema.safeParse({ happenedAt: "2026-04-01T10:15:00+00:00" }).success).toBe(true);
  });

  it("validates source/kind only when both are present", () => {
    expect(updateExternalRecordSchema.safeParse({ source: "todoist" }).success).toBe(true);
    expect(updateExternalRecordSchema.safeParse({ kind: "transcript" }).success).toBe(true);

    const invalidCombo = updateExternalRecordSchema.safeParse({
      source: "todoist",
      kind: "transcript",
    });
    expect(invalidCombo.success).toBe(false);

    const validCombo = updateExternalRecordSchema.safeParse({
      source: "todoist",
      kind: "task",
    });
    expect(validCombo.success).toBe(true);
  });
});

describe("validateMetadata", () => {
  it("returns success for null and undefined metadata", () => {
    expect(validateMetadata("email", null)).toEqual({ success: true, data: {} });
    expect(validateMetadata("email", undefined)).toEqual({ success: true, data: {} });
  });

  it("accepts valid email metadata", () => {
    const result = validateMetadata("email", {
      messageId: "m-123",
      threadId: "t-456",
      direction: "inbound",
      from: "sender@example.com",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageId).toBe("m-123");
    }
  });

  it("rejects invalid linkedin metadata", () => {
    const result = validateMetadata("linkedin", {
      profileUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid metadata for source \"linkedin\"");
      expect(result.error).toContain("profileUrl");
    }
  });

  it("accepts generic metadata for manual and other", () => {
    const manual = validateMetadata("manual", { any: "shape", nested: { ok: true } });
    const other = validateMetadata("other", { numbers: [1, 2, 3], flag: false });

    expect(manual.success).toBe(true);
    expect(other.success).toBe(true);
  });
});

describe("getValidKindsForSource", () => {
  it("returns expected kinds for email", () => {
    expect(getValidKindsForSource("email")).toEqual([
      "message",
      "thread",
      "snippet",
      "reference",
    ]);
  });

  it("returns all kinds for manual", () => {
    expect(getValidKindsForSource("manual")).toEqual(KINDS);
  });
});
