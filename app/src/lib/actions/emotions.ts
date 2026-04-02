"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getUserAccountId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

// Emotions
export async function getEmotions() {
  try {
    const accountId = await getUserAccountId();
    const emotions = await db.emotion.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
    return emotions;
  } catch (error) {
    console.error("Error fetching emotions:", error);
    return [];
  }
}

export async function ensureDefaultEmotions() {
  const accountId = await getUserAccountId();
  const existing = await db.emotion.findMany({
    where: { accountId },
  });

  if (existing.length === 0) {
    const defaults = [
      { name: "Happy", type: "positive" },
      { name: "Grateful", type: "positive" },
      { name: "Excited", type: "positive" },
      { name: "Peaceful", type: "positive" },
      { name: "Loved", type: "positive" },
      { name: "Neutral", type: "neutral" },
      { name: "Thoughtful", type: "neutral" },
      { name: "Busy", type: "neutral" },
      { name: "Tired", type: "neutral" },
      { name: "Sad", type: "negative" },
      { name: "Anxious", type: "negative" },
      { name: "Frustrated", type: "negative" },
      { name: "Worried", type: "negative" },
      { name: "Angry", type: "negative" },
    ];
    for (const e of defaults) {
      await db.emotion.create({
        data: { accountId, name: e.name, type: e.type },
      });
    }
  }

  return getEmotions();
}

export async function createEmotion(name: string, type: string = "neutral") {
  const accountId = await getUserAccountId();
  const emotion = await db.emotion.create({
    data: { accountId, name, type },
  });
  return emotion;
}

export async function deleteEmotion(id: string) {
  const accountId = await getUserAccountId();
  const emotion = await db.emotion.findFirst({
    where: { id, accountId },
  });
  if (!emotion) throw new Error("Emotion not found");

  await db.emotion.delete({ where: { id } });
  return { success: true };
}
