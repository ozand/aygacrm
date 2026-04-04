import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  userVault: { findFirst: vi.fn() },
  contact: { count: vi.fn(), findMany: vi.fn() },
  note: { count: vi.fn(), findMany: vi.fn() },
  contactImportantDate: { findMany: vi.fn() },
  contactReminder: { count: vi.fn() },
  externalRecord: { findMany: vi.fn() },
  contactTask: { findMany: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { getDashboardStats, getRecentActivity } from "@/lib/actions/dashboard";

describe("dashboard server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });

    mockDb.contact.count.mockResolvedValue(0);
    mockDb.note.count.mockResolvedValue(0);
    mockDb.contactImportantDate.findMany.mockResolvedValue([]);
    mockDb.contact.findMany.mockResolvedValue([]);
    mockDb.contactReminder.count.mockResolvedValue(0);

    mockDb.externalRecord.findMany.mockResolvedValue([]);
    mockDb.note.findMany.mockResolvedValue([]);
    mockDb.contactTask.findMany.mockResolvedValue([]);
  });

  it("getDashboardStats returns expected shape", async () => {
    const today = new Date();
    const within30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
    const beyond30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45);

    const recentContacts = [
      {
        id: "contact-1",
        firstName: "Jane",
        lastName: "Doe",
        nickname: null,
        updatedAt: new Date("2026-01-10T00:00:00.000Z"),
      },
      {
        id: "contact-2",
        firstName: "John",
        lastName: "Smith",
        nickname: null,
        updatedAt: new Date("2026-01-09T00:00:00.000Z"),
      },
    ];

    mockDb.contact.count.mockResolvedValue(12);
    mockDb.note.count.mockResolvedValue(34);
    mockDb.contactImportantDate.findMany.mockResolvedValue([
      { month: within30Days.getMonth() + 1, day: within30Days.getDate() },
      { month: beyond30Days.getMonth() + 1, day: beyond30Days.getDate() },
      { month: null, day: 15 },
    ]);
    mockDb.contact.findMany.mockResolvedValue(recentContacts);
    mockDb.contactReminder.count.mockResolvedValue(5);

    const result = await getDashboardStats();

    expect(result).toEqual({
      totalContacts: 12,
      totalNotes: 34,
      upcomingEvents: 1,
      activeReminders: 5,
      recentContacts,
    });
  });

  it("getDashboardStats returns zeros and empty recentContacts when no data", async () => {
    const result = await getDashboardStats();

    expect(result).toEqual({
      totalContacts: 0,
      totalNotes: 0,
      upcomingEvents: 0,
      activeReminders: 0,
      recentContacts: [],
    });
  });

  it("getRecentActivity merges and sorts external records, notes, and tasks", async () => {
    mockDb.externalRecord.findMany.mockResolvedValue([
      {
        id: "record-1",
        title: null,
        source: "email",
        kind: "message",
        content: "First external content",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        happenedAt: null,
        contact: { id: "contact-1", firstName: "Alice", lastName: "Lee", nickname: null },
      },
      {
        id: "record-2",
        title: "Latest External",
        source: "linkedin",
        kind: "note",
        content: "Second external content",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
        happenedAt: new Date("2026-01-05T10:00:00.000Z"),
        contact: { id: "contact-2", firstName: "Bob", lastName: "Ray", nickname: null },
      },
    ]);

    mockDb.note.findMany.mockResolvedValue([
      {
        id: 101,
        title: "Note One",
        body: "Important note body",
        contactId: "contact-3",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
        contact: { id: "contact-3", firstName: "Cara", lastName: "Ng", nickname: null },
      },
    ]);

    mockDb.contactTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        name: "Follow up",
        completed: false,
        contactId: "contact-4",
        createdAt: new Date("2026-01-04T10:00:00.000Z"),
        contact: { id: "contact-4", firstName: "Dan", lastName: "Yu", nickname: null },
      },
    ]);

    const result = await getRecentActivity();

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.id)).toEqual(["record-2", "task-1", "101", "record-1"]);
    expect(result.map((item) => item.type)).toEqual(["external_record", "task", "note", "external_record"]);
    expect(result[3]).toMatchObject({
      title: "email/message",
      contactName: "Alice Lee",
    });
  });

  it("getRecentActivity respects the limit parameter", async () => {
    mockDb.externalRecord.findMany.mockResolvedValue([
      {
        id: "record-1",
        title: "Old",
        source: "email",
        kind: "message",
        content: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        happenedAt: null,
        contact: { id: "contact-1", firstName: "A", lastName: "One", nickname: null },
      },
      {
        id: "record-2",
        title: "Newest",
        source: "email",
        kind: "message",
        content: null,
        createdAt: new Date("2026-01-06T00:00:00.000Z"),
        happenedAt: null,
        contact: { id: "contact-2", firstName: "B", lastName: "Two", nickname: null },
      },
    ]);

    mockDb.note.findMany.mockResolvedValue([
      {
        id: 202,
        title: "Mid",
        body: "Body",
        contactId: "contact-3",
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
        contact: { id: "contact-3", firstName: "C", lastName: "Three", nickname: null },
      },
    ]);

    mockDb.contactTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        name: "Second newest",
        completed: true,
        contactId: "contact-4",
        createdAt: new Date("2026-01-05T12:00:00.000Z"),
        contact: { id: "contact-4", firstName: "D", lastName: "Four", nickname: null },
      },
    ]);

    const result = await getRecentActivity(2);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.id)).toEqual(["record-2", "task-1"]);
    expect(mockDb.externalRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(mockDb.note.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(mockDb.contactTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });

  it("getRecentActivity returns empty array when there is no activity", async () => {
    const result = await getRecentActivity();
    expect(result).toEqual([]);
  });
});
