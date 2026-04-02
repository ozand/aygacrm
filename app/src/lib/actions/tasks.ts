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

// Get tasks for a contact
export async function getTasksForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const tasks = await db.contactTask.findMany({
      where: { contactId },
      orderBy: [
        { completed: "asc" },
        { dueAt: "asc" },
        { createdAt: "desc" },
      ],
    });

    return tasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

// Get all tasks for dashboard (upcoming and overdue)
export async function getUpcomingTasks(limit: number = 10) {
  try {
    const { vault } = await getUserVault();

    const tasks = await db.contactTask.findMany({
      where: {
        contact: { vaultId: vault.id },
        completed: false,
        dueAt: { not: null },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
      },
      orderBy: { dueAt: "asc" },
      take: limit,
    });

    return tasks;
  } catch (error) {
    console.error("Error fetching upcoming tasks:", error);
    return [];
  }
}

// Get overdue tasks
export async function getOverdueTasks() {
  try {
    const { vault } = await getUserVault();
    const now = new Date();

    const tasks = await db.contactTask.findMany({
      where: {
        contact: { vaultId: vault.id },
        completed: false,
        dueAt: { lt: now },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    return tasks;
  } catch (error) {
    console.error("Error fetching overdue tasks:", error);
    return [];
  }
}

// Create a new task
export async function createTask(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("label") as string;
    const description = formData.get("description") as string | null;
    const dueAtStr = formData.get("dueAt") as string | null;

    if (!contactId || !name?.trim()) {
      return { success: false, error: "Contact and task name are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const task = await db.contactTask.create({
      data: {
        contactId,
        name: name.trim(),
        description: description?.trim() || null,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/dashboard");

    return { success: true, data: task };
  } catch (error) {
    console.error("Error creating task:", error);
    return { success: false, error: "Failed to create task" };
  }
}

// Update a task
export async function updateTask(
  taskId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const name = formData.get("label") as string;
    const description = formData.get("description") as string | null;
    const dueAtStr = formData.get("dueAt") as string | null;

    // Verify task belongs to user's vault
    const existingTask = await db.contactTask.findFirst({
      where: { id: taskId },
      include: { contact: true },
    });

    if (!existingTask || existingTask.contact.vaultId !== vault.id) {
      return { success: false, error: "Task not found" };
    }

    const task = await db.contactTask.update({
      where: { id: taskId },
      data: {
        name: name?.trim() || existingTask.name,
        description: description?.trim() || null,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
      },
    });

    revalidatePath(`/contacts/${existingTask.contactId}`);
    revalidatePath("/dashboard");

    return { success: true, data: task };
  } catch (error) {
    console.error("Error updating task:", error);
    return { success: false, error: "Failed to update task" };
  }
}

// Toggle task completion
export async function toggleTaskComplete(taskId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify task belongs to user's vault
    const existingTask = await db.contactTask.findFirst({
      where: { id: taskId },
      include: { contact: true },
    });

    if (!existingTask || existingTask.contact.vaultId !== vault.id) {
      return { success: false, error: "Task not found" };
    }

    const newCompleted = !existingTask.completed;

    const task = await db.contactTask.update({
      where: { id: taskId },
      data: {
        completed: newCompleted,
        completedAt: newCompleted ? new Date() : null,
      },
    });

    revalidatePath(`/contacts/${existingTask.contactId}`);
    revalidatePath("/dashboard");

    return { success: true, data: task };
  } catch (error) {
    console.error("Error toggling task:", error);
    return { success: false, error: "Failed to update task" };
  }
}

// Delete a task
export async function deleteTask(taskId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify task belongs to user's vault
    const existingTask = await db.contactTask.findFirst({
      where: { id: taskId },
      include: { contact: true },
    });

    if (!existingTask || existingTask.contact.vaultId !== vault.id) {
      return { success: false, error: "Task not found" };
    }

    await db.contactTask.delete({
      where: { id: taskId },
    });

    revalidatePath(`/contacts/${existingTask.contactId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { success: false, error: "Failed to delete task" };
  }
}
