"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendToChannel } from "@/lib/notifications/transport";
import crypto from "crypto";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Helper to get current user
async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// Get all notification channels for current user
export async function getNotificationChannels() {
  try {
    const user = await getCurrentUser();

    const channels = await db.userNotificationChannel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return channels;
  } catch (error) {
    console.error("Error fetching notification channels:", error);
    return [];
  }
}

// Create a notification channel
export async function createNotificationChannel(
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();

    const type = formData.get("type") as string;
    const label = formData.get("label") as string;
    const content = formData.get("content") as string;

    if (!type) {
      return { success: false, error: "Channel type is required" };
    }

    if (!label) {
      return { success: false, error: "Label is required" };
    }

    if (!content) {
      return { success: false, error: "Content (email/chat ID) is required" };
    }

    // Validate content based on type
    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(content)) {
        return { success: false, error: "Invalid email address" };
      }
    }

    // Check for duplicates
    const existing = await db.userNotificationChannel.findFirst({
      where: {
        userId: user.id,
        type,
        content,
      },
    });

    if (existing) {
      return { success: false, error: "This notification channel already exists" };
    }

    const channel = await db.userNotificationChannel.create({
      data: {
        userId: user.id,
        type,
        label,
        content,
        active: true,
        verified: type === "email" && content === user.email, // Auto-verify primary email
      },
    });

    revalidatePath("/settings");

    return { success: true, data: channel };
  } catch (error) {
    console.error("Error creating notification channel:", error);
    return { success: false, error: "Failed to create notification channel" };
  }
}

// Update a notification channel
export async function updateNotificationChannel(
  channelId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();

    const label = formData.get("label") as string;
    const active = formData.get("active") === "true";

    // Verify channel belongs to user
    const existing = await db.userNotificationChannel.findFirst({
      where: { id: channelId, userId: user.id },
    });

    if (!existing) {
      return { success: false, error: "Channel not found" };
    }

    const channel = await db.userNotificationChannel.update({
      where: { id: channelId },
      data: {
        label: label || existing.label,
        active,
      },
    });

    revalidatePath("/settings");

    return { success: true, data: channel };
  } catch (error) {
    console.error("Error updating notification channel:", error);
    return { success: false, error: "Failed to update notification channel" };
  }
}

// Toggle channel active status
export async function toggleNotificationChannel(
  channelId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();

    // Verify channel belongs to user
    const existing = await db.userNotificationChannel.findFirst({
      where: { id: channelId, userId: user.id },
    });

    if (!existing) {
      return { success: false, error: "Channel not found" };
    }

    const channel = await db.userNotificationChannel.update({
      where: { id: channelId },
      data: {
        active: !existing.active,
      },
    });

    revalidatePath("/settings");

    return { success: true, data: channel };
  } catch (error) {
    console.error("Error toggling notification channel:", error);
    return { success: false, error: "Failed to toggle notification channel" };
  }
}

// Delete a notification channel
export async function deleteNotificationChannel(
  channelId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();

    // Verify channel belongs to user
    const existing = await db.userNotificationChannel.findFirst({
      where: { id: channelId, userId: user.id },
    });

    if (!existing) {
      return { success: false, error: "Channel not found" };
    }

    await db.userNotificationChannel.delete({
      where: { id: channelId },
    });

    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error deleting notification channel:", error);
    return { success: false, error: "Failed to delete notification channel" };
  }
}

// Send a test notification
export async function sendTestNotification(
  channelId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();

    // Verify channel belongs to user
    const channel = await db.userNotificationChannel.findFirst({
      where: { id: channelId, userId: user.id },
    });

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    const result = await sendToChannel(
      channel,
      "Test Notification",
      "This is a test notification from AygaCRM."
    );

    // Record the sent notification
    await db.userNotificationSent.create({
      data: {
        channelId: channel.id,
        subject: "Test Notification",
        body: "This is a test notification from AygaCRM.",
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
      },
    });

    return {
      success: result.ok,
      ...(result.ok
        ? { data: { message: "Test notification sent" } }
        : { error: result.error }),
    };
  } catch (error) {
    console.error("Error sending test notification:", error);
    return { success: false, error: "Failed to send test notification" };
  }
}

// Get sent notifications history
export async function getSentNotifications(limit: number = 50) {
  try {
    const user = await getCurrentUser();

    const notifications = await db.userNotificationSent.findMany({
      where: {
        channel: {
          userId: user.id,
        },
      },
      include: {
        channel: {
          select: {
            type: true,
            label: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.error("Error fetching sent notifications:", error);
    return [];
  }
}

// Mark channel as verified (for email verification flow)
export async function verifyNotificationChannel(
  channelId: string,
  token: string
): Promise<ActionResult> {
  try {
    // In a real implementation, you'd validate the token
    // For now, just verify the channel
    const channel = await db.userNotificationChannel.findFirst({
      where: { id: channelId },
    });

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    await db.userNotificationChannel.update({
      where: { id: channelId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error verifying notification channel:", error);
    return { success: false, error: "Failed to verify notification channel" };
  }
}
