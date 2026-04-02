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

export async function getFiles(type?: string) {
  const vault = await getUserVault();

  const whereClause: any = { vaultId: vault.id };
  if (type) {
    whereClause.type = type;
  }

  return db.file.findMany({
    where: whereClause,
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFile(id: string) {
  const vault = await getUserVault();

  return db.file.findFirst({
    where: { id, vaultId: vault.id },
    include: {
      contact: true,
    },
  });
}

export async function deleteFile(id: string) {
  const vault = await getUserVault();

  const file = await db.file.findFirst({
    where: { id, vaultId: vault.id },
  });

  if (!file) {
    throw new Error("File not found");
  }

  // Delete from database
  await db.file.delete({ where: { id } });

  // Note: Physical file deletion would need to be handled separately
  // based on where files are stored (local, S3, etc.)

  revalidatePath("/files");
  return { success: true };
}

export async function getFileStats() {
  const vault = await getUserVault();

  const [totalFiles, totalSize, byType] = await Promise.all([
    db.file.count({ where: { vaultId: vault.id } }),
    db.file.aggregate({
      where: { vaultId: vault.id },
      _sum: { size: true },
    }),
    db.file.groupBy({
      by: ["type"],
      where: { vaultId: vault.id },
      _count: true,
    }),
  ]);

  return {
    totalFiles,
    totalSize: totalSize._sum.size || 0,
    byType: byType.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}
