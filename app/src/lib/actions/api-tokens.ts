"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateToken, hashToken } from "@/lib/api/auth";

// Helper to get user's account
async function getUserAndAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { account: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    userId: user.id,
    accountId: user.accountId,
  };
}

// List all API tokens for current user
export async function getApiTokens() {
  const { userId } = await getUserAndAccount();

  return db.apiToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      abilities: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// Create a new API token
export async function createApiToken(data: {
  name: string;
  abilities?: string[];
  expiresInDays?: number;
}): Promise<{ token: string; id: string }> {
  const { userId } = await getUserAndAccount();

  const { token, prefix } = generateToken();
  const hashedToken = hashToken(token);

  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiToken = await db.apiToken.create({
    data: {
      userId,
      name: data.name.trim(),
      token: hashedToken,
      tokenPrefix: prefix,
      abilities: data.abilities || ["*"], // Default to all abilities
      expiresAt,
    },
  });

  revalidatePath("/settings");

  // Return the plain token only once - it cannot be retrieved later
  return {
    token,
    id: apiToken.id,
  };
}

// Update an API token
export async function updateApiToken(
  id: string,
  data: {
    name?: string;
    abilities?: string[];
  }
) {
  const { userId } = await getUserAndAccount();

  const existing = await db.apiToken.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error("API token not found");
  }

  const updated = await db.apiToken.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      abilities: data.abilities,
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      abilities: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  revalidatePath("/settings");
  return updated;
}

// Delete an API token
export async function deleteApiToken(id: string) {
  const { userId } = await getUserAndAccount();

  const existing = await db.apiToken.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error("API token not found");
  }

  await db.apiToken.delete({ where: { id } });

  revalidatePath("/settings");
  return { success: true };
}

// Revoke all API tokens
export async function revokeAllApiTokens() {
  const { userId } = await getUserAndAccount();

  const result = await db.apiToken.deleteMany({
    where: { userId },
  });

  revalidatePath("/settings");
  return { success: true, count: result.count };
}
