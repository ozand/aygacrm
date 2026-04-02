"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Helper to get current user's vault
async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) {
    throw new Error("No vault found for user");
  }

  return { userId: session.user.id, vault: userVault.vault };
}

// Get goals for a contact
export async function getGoalsForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const goals = await db.goal.findMany({
      where: { contactId },
      include: {
        streakEvents: {
          orderBy: { happenedAt: "desc" },
          take: 7, // Last 7 streak events
        },
      },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });

    return goals;
  } catch (error) {
    console.error("Error fetching goals:", error);
    return [];
  }
}

// Create a goal
export async function createGoal(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("name") as string;

    if (!contactId || !name) {
      return { success: false, error: "Name is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const goal = await db.goal.create({
      data: {
        name: name.trim(),
        contactId,
        active: true,
        streakCount: 0,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: goal };
  } catch (error) {
    console.error("Error creating goal:", error);
    return { success: false, error: "Failed to create goal" };
  }
}

// Update goal (toggle active, increment streaks, rename)
export async function updateGoal(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string | null;
    const activeStr = formData.get("active") as string | null;
    const incrementStreak = formData.get("incrementStreak") as string | null;
    const resetStreak = formData.get("resetStreak") as string | null;

    if (!id) {
      return { success: false, error: "Goal ID is required" };
    }

    // Get goal and verify ownership
    const goal = await db.goal.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!goal || goal.contact.vaultId !== vault.id) {
      return { success: false, error: "Goal not found" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (name !== null) {
      updateData.name = name.trim();
    }

    if (activeStr !== null) {
      updateData.active = activeStr === "true";
    }

    if (incrementStreak === "true") {
      updateData.streakCount = goal.streakCount + 1;
      
      // Also create a streak event
      await db.streak.create({
        data: {
          goalId: id,
          happenedAt: new Date(),
        },
      });
    }

    if (resetStreak === "true") {
      updateData.streakCount = 0;
    }

    await db.goal.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/contacts/${goal.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating goal:", error);
    return { success: false, error: "Failed to update goal" };
  }
}

// Delete a goal
export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify goal belongs to user's vault
    const goal = await db.goal.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!goal || goal.contact.vaultId !== vault.id) {
      return { success: false, error: "Goal not found" };
    }

    const contactId = goal.contactId;

    await db.goal.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting goal:", error);
    return { success: false, error: "Failed to delete goal" };
  }
}

// ============================================
// STREAK MANAGEMENT
// ============================================

// Log a streak event for a goal
export async function logStreak(goalId: string, happenedAt?: Date): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify goal belongs to user's vault
    const goal = await db.goal.findFirst({
      where: { id: goalId },
      include: { contact: true },
    });

    if (!goal || goal.contact.vaultId !== vault.id) {
      return { success: false, error: "Goal not found" };
    }

    // Check if there's already a streak for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingToday = await db.streak.findFirst({
      where: {
        goalId,
        happenedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingToday) {
      return { success: false, error: "Already logged a streak for today" };
    }

    // Create streak event
    const streak = await db.streak.create({
      data: {
        goalId,
        happenedAt: happenedAt ?? new Date(),
      },
    });

    // Update streak count on goal
    await db.goal.update({
      where: { id: goalId },
      data: { streakCount: { increment: 1 } },
    });

    revalidatePath(`/contacts/${goal.contactId}`);

    return { success: true, data: streak };
  } catch (error) {
    console.error("Error logging streak:", error);
    return { success: false, error: "Failed to log streak" };
  }
}

// Get streak history for a goal
export async function getStreakHistory(goalId: string, options?: {
  limit?: number;
  offset?: number;
}) {
  try {
    const { vault } = await getUserVault();

    // Verify goal belongs to user's vault
    const goal = await db.goal.findFirst({
      where: { id: goalId },
      include: { contact: true },
    });

    if (!goal || goal.contact.vaultId !== vault.id) {
      return [];
    }

    const streaks = await db.streak.findMany({
      where: { goalId },
      orderBy: { happenedAt: "desc" },
      take: options?.limit ?? 30,
      skip: options?.offset ?? 0,
    });

    return streaks;
  } catch (error) {
    console.error("Error fetching streak history:", error);
    return [];
  }
}

// Delete a streak event
export async function deleteStreak(streakId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const streak = await db.streak.findFirst({
      where: { id: streakId },
      include: { goal: { include: { contact: true } } },
    });

    if (!streak || streak.goal.contact.vaultId !== vault.id) {
      return { success: false, error: "Streak not found" };
    }

    await db.streak.delete({
      where: { id: streakId },
    });

    // Decrement streak count on goal
    await db.goal.update({
      where: { id: streak.goalId },
      data: { streakCount: { decrement: 1 } },
    });

    revalidatePath(`/contacts/${streak.goal.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting streak:", error);
    return { success: false, error: "Failed to delete streak" };
  }
}

// Calculate current streak (consecutive days)
export async function calculateCurrentStreak(goalId: string): Promise<number> {
  try {
    const { vault } = await getUserVault();

    const goal = await db.goal.findFirst({
      where: { id: goalId },
      include: { contact: true },
    });

    if (!goal || goal.contact.vaultId !== vault.id) {
      return 0;
    }

    // Get all streak events ordered by date
    const streaks = await db.streak.findMany({
      where: { goalId },
      orderBy: { happenedAt: "desc" },
    });

    if (streaks.length === 0) return 0;

    let currentStreak = 0;
    let previousDate: Date | null = null;

    for (const streak of streaks) {
      const streakDate = new Date(streak.happenedAt);
      streakDate.setHours(0, 0, 0, 0);

      if (previousDate === null) {
        // First streak - check if it's today or yesterday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (streakDate.getTime() === today.getTime() || 
            streakDate.getTime() === yesterday.getTime()) {
          currentStreak = 1;
          previousDate = streakDate;
        } else {
          // Streak is broken
          break;
        }
      } else {
        // Check if this is the previous day
        const expectedPreviousDay = new Date(previousDate);
        expectedPreviousDay.setDate(expectedPreviousDay.getDate() - 1);

        if (streakDate.getTime() === expectedPreviousDay.getTime()) {
          currentStreak++;
          previousDate = streakDate;
        } else {
          // Streak is broken
          break;
        }
      }
    }

    return currentStreak;
  } catch (error) {
    console.error("Error calculating current streak:", error);
    return 0;
  }
}
