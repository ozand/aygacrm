import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  userVault: { findFirst: vi.fn() },
  contact: { findMany: vi.fn() },
  note: { findMany: vi.fn() },
  contactTask: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  group: { findMany: vi.fn() },
  label: { findMany: vi.fn() },
  externalRecord: { findMany: vi.fn() },
  postTag: { findMany: vi.fn() },
  postPhoto: { findMany: vi.fn() },
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

import { globalSearch } from "@/lib/actions/search";

describe("search server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });

    mockDb.contact.findMany.mockResolvedValue([]);
    mockDb.note.findMany.mockResolvedValue([]);
    mockDb.contactTask.findMany.mockResolvedValue([]);
    mockDb.activity.findMany.mockResolvedValue([]);
    mockDb.group.findMany.mockResolvedValue([]);
    mockDb.label.findMany.mockResolvedValue([]);
    mockDb.externalRecord.findMany.mockResolvedValue([]);
    mockDb.postTag.findMany.mockResolvedValue([]);
    mockDb.postPhoto.findMany.mockResolvedValue([]);
  });

  it("globalSearch returns empty results for empty query", async () => {
    await expect(globalSearch("")).resolves.toEqual([]);
    await expect(globalSearch(" ")).resolves.toEqual([]);
    await expect(globalSearch("a")).resolves.toEqual([]);
    expect(mockDb.userVault.findFirst).not.toHaveBeenCalled();
  });

  it("globalSearch returns correct shape with type-tagged results", async () => {
    mockDb.contact.findMany.mockResolvedValue([
      {
        id: "contact-1",
        firstName: "Alice",
        lastName: "Stone",
        nickname: null,
        jobPosition: "Manager",
        company: { name: "Acme" },
        contactInformation: [{ data: "alice@example.com", type: { name: "Email" } }],
      },
    ]);

    mockDb.note.findMany.mockResolvedValue([
      {
        id: 10,
        title: "Meeting Notes",
        body: "Discussed roadmap",
        contact: { id: "contact-1", firstName: "Alice", lastName: "Stone" },
      },
    ]);

    mockDb.contactTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        name: "Prepare deck",
        description: "Deck for monday",
        completed: true,
        contact: { id: "contact-1", firstName: "Alice", lastName: "Stone" },
      },
    ]);

    mockDb.activity.findMany.mockResolvedValue([
      {
        id: "activity-1",
        summary: "Call follow-up",
        description: "Reviewed next steps",
        contact: { id: "contact-1", firstName: "Alice", lastName: "Stone" },
      },
    ]);

    mockDb.group.findMany.mockResolvedValue([
      { id: "group-1", name: "Prospects", _count: { contacts: 3 } },
    ]);

    mockDb.label.findMany.mockResolvedValue([
      { id: "label-1", name: "VIP", _count: { contacts: 2 } },
    ]);

    mockDb.postTag.findMany.mockResolvedValue([{ id: "tag-1", name: "Ideas", slug: "ideas" }]);

    mockDb.postPhoto.findMany.mockResolvedValue([
      {
        id: "photo-1",
        fileName: "lunch.jpg",
        caption: "Team lunch",
        postId: "post-1",
        post: { id: "post-1", title: "Weekly Log" },
      },
    ]);

    const results = await globalSearch("alice");

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "contact", id: "contact-1", title: "Alice Stone" }),
        expect.objectContaining({ type: "note", id: "10", title: "Meeting Notes" }),
        expect.objectContaining({ type: "task", id: "task-1", title: "Prepare deck" }),
        expect.objectContaining({ type: "activity", id: "activity-1", title: "Call follow-up" }),
        expect.objectContaining({ type: "group", id: "group-1", title: "Prospects" }),
        expect.objectContaining({ type: "label", id: "label-1", title: "VIP" }),
        expect.objectContaining({ type: "postTag", id: "tag-1", title: "Ideas" }),
        expect.objectContaining({ type: "postPhoto", id: "photo-1", title: "lunch.jpg" }),
      ])
    );
  });

  it("results include externalRecord type", async () => {
    mockDb.externalRecord.findMany.mockResolvedValue([
      {
        id: "record-1",
        title: "Email Thread",
        content: "Discussion with Alice",
        source: "email",
        kind: "thread",
        contact: { id: "contact-2", firstName: "Bob", lastName: "Ray" },
      },
    ]);

    const results = await globalSearch("discussion");
    const external = results.find((item) => item.type === "externalRecord");

    expect(external).toBeDefined();
    expect(external).toMatchObject({
      type: "externalRecord",
      id: "record-1",
      title: "Email Thread",
      url: "/contacts/contact-2",
    });
  });

  it("results are limited with take 10 per major type", async () => {
    await globalSearch("alpha");

    expect(mockDb.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mockDb.note.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mockDb.contactTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mockDb.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mockDb.externalRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it("throws on auth failure", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(globalSearch("alice")).rejects.toThrow("Not authenticated");
  });
});
