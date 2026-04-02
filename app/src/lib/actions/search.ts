"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Helper to get user's vault
async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) {
    throw new Error("No vault found");
  }

  return { userId: session.user.id, vault: userVault.vault };
}

export interface SearchResult {
  type: "contact" | "note" | "task" | "activity" | "group" | "label" | "postTag" | "postPhoto";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  matchedField?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const { vault } = await getUserVault();
  const searchTerm = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  // Search contacts
  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      deletedAt: null,
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { nickname: { contains: searchTerm, mode: "insensitive" } },
        { jobPosition: { contains: searchTerm, mode: "insensitive" } },
        {
          contactInformation: {
            some: {
              data: { contains: searchTerm, mode: "insensitive" },
            },
          },
        },
      ],
    },
    include: {
      company: { select: { name: true } },
      contactInformation: {
        include: { type: true },
        take: 1,
      },
    },
    take: 10,
  });

  for (const contact of contacts) {
    const name =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.nickname ||
      "Unnamed";
    
    let subtitle = contact.jobPosition || undefined;
    if (contact.company?.name) {
      subtitle = subtitle ? `${subtitle} at ${contact.company.name}` : contact.company.name;
    }
    
    // Check if match was in contact info
    const matchedInfo = contact.contactInformation.find((ci) =>
      ci.data.toLowerCase().includes(searchTerm)
    );
    
    results.push({
      type: "contact",
      id: contact.id,
      title: name,
      subtitle,
      url: `/contacts/${contact.id}`,
      matchedField: matchedInfo ? `${matchedInfo.type.name}: ${matchedInfo.data}` : undefined,
    });
  }

  // Search notes
  const notes = await db.note.findMany({
    where: {
      vaultId: vault.id,
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { body: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    take: 10,
  });

  for (const note of notes) {
    const contactName =
      [note.contact.firstName, note.contact.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    
    results.push({
      type: "note",
      id: note.id.toString(),
      title: note.title || note.body.substring(0, 50) + (note.body.length > 50 ? "..." : ""),
      subtitle: `Note on ${contactName}`,
      url: `/contacts/${note.contact.id}`,
    });
  }

  // Search tasks
  const tasks = await db.contactTask.findMany({
    where: {
      contact: { vaultId: vault.id },
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    take: 10,
  });

  for (const task of tasks) {
    const contactName =
      [task.contact.firstName, task.contact.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    
    results.push({
      type: "task",
      id: task.id,
      title: task.name,
      subtitle: `Task for ${contactName}${task.completed ? " (Completed)" : ""}`,
      url: `/contacts/${task.contact.id}`,
    });
  }

  // Search activities
  const activities = await db.activity.findMany({
    where: {
      vaultId: vault.id,
      OR: [
        { summary: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    take: 10,
  });

  for (const activity of activities) {
    const contactName =
      [activity.contact.firstName, activity.contact.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    
    results.push({
      type: "activity",
      id: activity.id,
      title: activity.summary || "Activity",
      subtitle: `Activity with ${contactName}`,
      url: `/contacts/${activity.contact.id}`,
    });
  }

  // Search groups
  const groups = await db.group.findMany({
    where: {
      vaultId: vault.id,
      name: { contains: searchTerm, mode: "insensitive" },
    },
    include: {
      _count: { select: { contacts: true } },
    },
    take: 5,
  });

  for (const group of groups) {
    results.push({
      type: "group",
      id: group.id,
      title: group.name,
      subtitle: `${group._count.contacts} contacts`,
      url: `/groups`,
    });
  }

  // Search labels
  const labels = await db.label.findMany({
    where: {
      vaultId: vault.id,
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      _count: { select: { contacts: true } },
    },
    take: 5,
  });

  for (const label of labels) {
    results.push({
      type: "label",
      id: label.id,
      title: label.name,
      subtitle: `${label._count.contacts} contacts`,
      url: `/labels/${label.id}`,
    });
  }

  // Search post tags
  const postTags = await db.postTag.findMany({
    where: {
      vaultId: vault.id,
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { slug: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    take: 5,
  });

  for (const tag of postTags) {
    results.push({
      type: "postTag",
      id: tag.id,
      title: tag.name,
      subtitle: "Journal Tag",
      url: `/journal/tags/${tag.id}`, // Assuming a journal tag detail page
    });
  }

  // Search post photos
  const postPhotos = await db.postPhoto.findMany({
    where: {
      post: {
        journal: {
          vaultId: vault.id,
        },
      },
      OR: [
        { caption: { contains: searchTerm, mode: "insensitive" } },
        { fileName: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    include: {
      post: {
        select: { id: true, title: true },
      },
    },
    take: 5,
  });

  for (const photo of postPhotos) {
    results.push({
      type: "postPhoto",
      id: photo.id,
      title: photo.fileName || photo.caption || "Journal Photo",
      subtitle: `In post: ${photo.post?.title || photo.post.id}`,
      url: `/journal/posts/${photo.postId}`, // Assuming a journal post detail page
    });
  }

  return results;
}

// Quick search for contacts only (for dropdowns/pickers)
export async function searchContacts(query: string) {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const { vault } = await getUserVault();
  const searchTerm = query.trim();

  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      deletedAt: null,
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { nickname: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
    },
    take: 10,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return contacts.map((c) => ({
    id: c.id,
    name:
      [c.firstName, c.lastName].filter(Boolean).join(" ") ||
      c.nickname ||
      "Unnamed",
  }));
}
