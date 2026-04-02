"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

  return userVault.vault;
}

async function getUserVaultAndAccount() {
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

  return {
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

// ==================== JOURNALS ====================

export async function getJournals() {
  const vault = await getUserVault();

  return db.journal.findMany({
    where: { vaultId: vault.id },
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJournal(id: string) {
  const vault = await getUserVault();

  return db.journal.findFirst({
    where: { id, vaultId: vault.id },
    include: {
      posts: {
        orderBy: { writtenAt: "desc" },
        include: {
          sections: { orderBy: { position: "asc" } },
          sliceOfLife: true,
        },
      },
      slices: {
        orderBy: { startedAt: "desc" },
      },
    },
  });
}

export async function createJournal(data: {
  name: string;
  description?: string;
}) {
  const vault = await getUserVault();

  const journal = await db.journal.create({
    data: {
      name: data.name,
      description: data.description || null,
      vaultId: vault.id,
    },
  });

  revalidatePath("/journal");
  return journal;
}

export async function updateJournal(
  id: string,
  data: { name?: string; description?: string }
) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.journal.findFirst({
    where: { id, vaultId: vault.id },
  });

  if (!existing) {
    throw new Error("Journal not found");
  }

  const journal = await db.journal.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${id}`);
  return journal;
}

export async function deleteJournal(id: string) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.journal.findFirst({
    where: { id, vaultId: vault.id },
  });

  if (!existing) {
    throw new Error("Journal not found");
  }

  await db.journal.delete({ where: { id } });

  revalidatePath("/journal");
  return { success: true };
}

// ==================== POSTS ====================

export async function getPosts(journalId?: string) {
  const vault = await getUserVault();

  const whereClause: any = {
    journal: { vaultId: vault.id },
  };

  if (journalId) {
    whereClause.journalId = journalId;
  }

  return db.post.findMany({
    where: whereClause,
    include: {
      journal: true,
      sections: { orderBy: { position: "asc" } },
      sliceOfLife: true,
    },
    orderBy: { writtenAt: "desc" },
  });
}

export async function getPost(id: number) {
  const vault = await getUserVault();

  return db.post.findFirst({
    where: {
      id,
      journal: { vaultId: vault.id },
    },
    include: {
      journal: true,
      sections: { orderBy: { position: "asc" } },
      sliceOfLife: true,
      metrics: {
        include: { journalMetric: true },
      },
    },
  });
}

export async function createPost(data: {
  journalId: string;
  title?: string;
  content?: string;
  writtenAt?: Date;
  sliceOfLifeId?: string;
  sections?: { label?: string; content?: string; position?: number }[];
}) {
  const vault = await getUserVault();

  // Verify journal ownership
  const journal = await db.journal.findFirst({
    where: { id: data.journalId, vaultId: vault.id },
  });

  if (!journal) {
    throw new Error("Journal not found");
  }

  const post = await db.post.create({
    data: {
      title: data.title || null,
      content: data.content || null,
      writtenAt: data.writtenAt || new Date(),
      journalId: data.journalId,
      sliceOfLifeId: data.sliceOfLifeId || null,
      sections: data.sections
        ? {
            create: data.sections.map((s, i) => ({
              label: s.label || null,
              content: s.content || null,
              position: s.position ?? i,
            })),
          }
        : undefined,
    },
    include: {
      sections: true,
    },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${data.journalId}`);
  return post;
}

export async function updatePost(
  id: number,
  data: {
    title?: string;
    content?: string;
    writtenAt?: Date;
    sliceOfLifeId?: string | null;
  }
) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.post.findFirst({
    where: { id, journal: { vaultId: vault.id } },
    include: { journal: true },
  });

  if (!existing) {
    throw new Error("Post not found");
  }

  const post = await db.post.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      writtenAt: data.writtenAt,
      sliceOfLifeId: data.sliceOfLifeId,
    },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${existing.journalId}`);
  revalidatePath(`/journal/post/${id}`);
  return post;
}

export async function deletePost(id: number) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.post.findFirst({
    where: { id, journal: { vaultId: vault.id } },
    include: { journal: true },
  });

  if (!existing) {
    throw new Error("Post not found");
  }

  await db.post.delete({ where: { id } });

  revalidatePath("/journal");
  revalidatePath(`/journal/${existing.journalId}`);
  return { success: true };
}

// ==================== POST SECTIONS ====================

export async function addPostSection(
  postId: number,
  data: { label?: string; content?: string; position?: number }
) {
  const vault = await getUserVault();

  // Verify ownership
  const post = await db.post.findFirst({
    where: { id: postId, journal: { vaultId: vault.id } },
    include: { sections: true },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  const maxPosition = post.sections.reduce(
    (max, s) => Math.max(max, s.position),
    -1
  );

  const section = await db.postSection.create({
    data: {
      postId,
      label: data.label || null,
      content: data.content || null,
      position: data.position ?? maxPosition + 1,
    },
  });

  revalidatePath(`/journal/post/${postId}`);
  return section;
}

export async function updatePostSection(
  id: number,
  data: { label?: string; content?: string; position?: number }
) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.postSection.findFirst({
    where: { id, post: { journal: { vaultId: vault.id } } },
    include: { post: true },
  });

  if (!existing) {
    throw new Error("Section not found");
  }

  const section = await db.postSection.update({
    where: { id },
    data: {
      label: data.label,
      content: data.content,
      position: data.position,
    },
  });

  revalidatePath(`/journal/post/${existing.postId}`);
  return section;
}

export async function deletePostSection(id: number) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.postSection.findFirst({
    where: { id, post: { journal: { vaultId: vault.id } } },
    include: { post: true },
  });

  if (!existing) {
    throw new Error("Section not found");
  }

  await db.postSection.delete({ where: { id } });

  revalidatePath(`/journal/post/${existing.postId}`);
  return { success: true };
}

// ==================== SLICES OF LIFE ====================

export async function getSlicesOfLife(journalId: string) {
  const vault = await getUserVault();

  // Verify journal ownership
  const journal = await db.journal.findFirst({
    where: { id: journalId, vaultId: vault.id },
  });

  if (!journal) {
    throw new Error("Journal not found");
  }

  return db.sliceOfLife.findMany({
    where: { journalId },
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function createSliceOfLife(data: {
  journalId: string;
  name: string;
  description?: string;
  startedAt?: Date;
  endedAt?: Date;
}) {
  const vault = await getUserVault();

  // Verify journal ownership
  const journal = await db.journal.findFirst({
    where: { id: data.journalId, vaultId: vault.id },
  });

  if (!journal) {
    throw new Error("Journal not found");
  }

  const slice = await db.sliceOfLife.create({
    data: {
      name: data.name,
      description: data.description || null,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      journalId: data.journalId,
    },
  });

  revalidatePath(`/journal/${data.journalId}`);
  return slice;
}

export async function updateSliceOfLife(
  id: string,
  data: {
    name?: string;
    description?: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }
) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.sliceOfLife.findFirst({
    where: { id, journal: { vaultId: vault.id } },
    include: { journal: true },
  });

  if (!existing) {
    throw new Error("Slice of life not found");
  }

  const slice = await db.sliceOfLife.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
    },
  });

  revalidatePath(`/journal/${existing.journalId}`);
  return slice;
}

export async function deleteSliceOfLife(id: string) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.sliceOfLife.findFirst({
    where: { id, journal: { vaultId: vault.id } },
    include: { journal: true },
  });

  if (!existing) {
    throw new Error("Slice of life not found");
  }

  await db.sliceOfLife.delete({ where: { id } });

  revalidatePath(`/journal/${existing.journalId}`);
  return { success: true };
}

// ==================== JOURNAL METRICS ====================
// These define what metrics can be tracked (e.g., "Weight", "Steps", "Mood")

export async function getJournalMetrics() {
  const { accountId } = await getUserVaultAndAccount();

  return db.journalMetric.findMany({
    where: { accountId },
    include: {
      _count: { select: { postMetrics: true } },
    },
    orderBy: { label: "asc" },
  });
}

export async function getJournalMetric(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  return db.journalMetric.findFirst({
    where: { id, accountId },
    include: {
      postMetrics: {
        include: {
          post: {
            select: {
              id: true,
              title: true,
              writtenAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
}

export async function createJournalMetric(data: {
  label: string;
  unit?: string;
}) {
  const { accountId } = await getUserVaultAndAccount();

  const metric = await db.journalMetric.create({
    data: {
      accountId,
      label: data.label,
      unit: data.unit || null,
    },
  });

  revalidatePath("/journal");
  revalidatePath("/settings");
  return metric;
}

export async function updateJournalMetric(
  id: string,
  data: { label?: string; unit?: string }
) {
  const { accountId } = await getUserVaultAndAccount();

  // Verify ownership
  const existing = await db.journalMetric.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw new Error("Metric not found");
  }

  const metric = await db.journalMetric.update({
    where: { id },
    data: {
      label: data.label,
      unit: data.unit,
    },
  });

  revalidatePath("/journal");
  revalidatePath("/settings");
  return metric;
}

export async function deleteJournalMetric(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  // Verify ownership
  const existing = await db.journalMetric.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw new Error("Metric not found");
  }

  await db.journalMetric.delete({ where: { id } });

  revalidatePath("/journal");
  revalidatePath("/settings");
  return { success: true };
}

// ==================== POST METRICS ====================
// These are the actual values recorded for each metric in a post

export async function getPostMetrics(postId: number) {
  const vault = await getUserVault();

  // Verify post ownership
  const post = await db.post.findFirst({
    where: { id: postId, journal: { vaultId: vault.id } },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  return db.postMetric.findMany({
    where: { postId },
    include: { journalMetric: true },
    orderBy: { journalMetric: { label: "asc" } },
  });
}

export async function addPostMetric(
  postId: number,
  data: { journalMetricId: string; value: number }
) {
  const vault = await getUserVault();

  // Verify post ownership
  const post = await db.post.findFirst({
    where: { id: postId, journal: { vaultId: vault.id } },
    include: { journal: true },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  // Check if metric already exists for this post
  const existing = await db.postMetric.findFirst({
    where: { postId, journalMetricId: data.journalMetricId },
  });

  if (existing) {
    // Update existing metric
    const metric = await db.postMetric.update({
      where: { id: existing.id },
      data: { value: data.value },
      include: { journalMetric: true },
    });
    revalidatePath(`/journal/post/${postId}`);
    return metric;
  }

  const metric = await db.postMetric.create({
    data: {
      postId,
      journalMetricId: data.journalMetricId,
      value: data.value,
    },
    include: { journalMetric: true },
  });

  revalidatePath(`/journal/post/${postId}`);
  return metric;
}

export async function updatePostMetric(id: number, value: number) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.postMetric.findFirst({
    where: { id, post: { journal: { vaultId: vault.id } } },
    include: { post: true },
  });

  if (!existing) {
    throw new Error("Metric not found");
  }

  const metric = await db.postMetric.update({
    where: { id },
    data: { value },
    include: { journalMetric: true },
  });

  revalidatePath(`/journal/post/${existing.postId}`);
  return metric;
}

export async function deletePostMetric(id: number) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.postMetric.findFirst({
    where: { id, post: { journal: { vaultId: vault.id } } },
    include: { post: true },
  });

  if (!existing) {
    throw new Error("Metric not found");
  }

  await db.postMetric.delete({ where: { id } });

  revalidatePath(`/journal/post/${existing.postId}`);
  return { success: true };
}

// Seed some default metrics
export async function seedJournalMetrics() {
  const { accountId } = await getUserVaultAndAccount();

  const existingCount = await db.journalMetric.count({
    where: { accountId },
  });

  if (existingCount > 0) {
    return { success: true, data: { message: "Metrics already exist" } };
  }

  const defaultMetrics = [
    { label: "Weight", unit: "kg" },
    { label: "Steps", unit: "steps" },
    { label: "Sleep Hours", unit: "hours" },
    { label: "Water Intake", unit: "glasses" },
    { label: "Mood", unit: "/10" },
    { label: "Energy Level", unit: "/10" },
    { label: "Stress Level", unit: "/10" },
  ];

  await db.journalMetric.createMany({
    data: defaultMetrics.map((m) => ({
      accountId,
      label: m.label,
      unit: m.unit,
    })),
  });

  revalidatePath("/journal");
  revalidatePath("/settings");
  return { success: true, data: { message: "Default metrics created" } };
}
