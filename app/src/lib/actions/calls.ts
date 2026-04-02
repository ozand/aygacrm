"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Helper to get current user's vault and account
async function getUserVaultAndAccount() {
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

  return { 
    userId: session.user.id, 
    vault: userVault.vault, 
    accountId: userVault.vault.accountId 
  };
}

// Get calls for a contact
export async function getCallsForContact(contactId: string) {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const calls = await db.call.findMany({
      where: { contactId },
      include: {
        callReason: true,
      },
      orderBy: { calledAt: "desc" },
    });

    return calls;
  } catch (error) {
    console.error("Error fetching calls:", error);
    return [];
  }
}

// Get call reasons for dropdown
export async function getCallReasons() {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const reasonTypes = await db.callReasonType.findMany({
      where: { accountId },
      include: {
        reasons: {
          orderBy: { label: "asc" },
        },
      },
      orderBy: { label: "asc" },
    });

    return reasonTypes;
  } catch (error) {
    console.error("Error fetching call reasons:", error);
    return [];
  }
}

// Create a new call
export async function createCall(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    const contactId = formData.get("contactId") as string;
    const calledAtStr = formData.get("calledAt") as string;
    const durationStr = formData.get("duration") as string | null;
    const description = formData.get("description") as string | null;
    const callReasonId = formData.get("callReasonId") as string | null;

    if (!contactId || !calledAtStr) {
      return { success: false, error: "Contact and date are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const call = await db.call.create({
      data: {
        contactId,
        calledAt: new Date(calledAtStr),
        duration: durationStr ? parseInt(durationStr, 10) : null,
        description: description?.trim() || null,
        callReasonId: callReasonId || null,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: call };
  } catch (error) {
    console.error("Error creating call:", error);
    return { success: false, error: "Failed to log call" };
  }
}

// Delete a call
export async function deleteCall(callId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify call belongs to user's vault
    const call = await db.call.findFirst({
      where: { id: callId },
      include: { contact: true },
    });

    if (!call || call.contact.vaultId !== vault.id) {
      return { success: false, error: "Call not found" };
    }

    await db.call.delete({
      where: { id: callId },
    });

    revalidatePath(`/contacts/${call.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting call:", error);
    return { success: false, error: "Failed to delete call" };
  }
}

// Seed default call reasons if none exist
export async function seedCallReasons(): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Check if reasons already exist
    const existing = await db.callReasonType.findFirst({
      where: { accountId },
    });

    if (existing) {
      return { success: true, data: { message: "Call reasons already exist" } };
    }

    // Create default reason types
    const personalType = await db.callReasonType.create({
      data: { accountId, label: "Personal" },
    });

    const businessType = await db.callReasonType.create({
      data: { accountId, label: "Business" },
    });

    // Create reasons
    await db.callReason.createMany({
      data: [
        { label: "Catch up", reasonTypeId: personalType.id },
        { label: "Birthday wishes", reasonTypeId: personalType.id },
        { label: "Check in", reasonTypeId: personalType.id },
        { label: "Planning event", reasonTypeId: personalType.id },
        { label: "Follow up", reasonTypeId: businessType.id },
        { label: "Meeting", reasonTypeId: businessType.id },
        { label: "Project discussion", reasonTypeId: businessType.id },
        { label: "Support", reasonTypeId: businessType.id },
      ],
    });

    return { success: true, data: { message: "Call reasons seeded" } };
  } catch (error) {
    console.error("Error seeding call reasons:", error);
    return { success: false, error: "Failed to seed call reasons" };
  }
}

// Create a call reason type
export async function createCallReasonType(label: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const reasonType = await db.callReasonType.create({
      data: { accountId, label },
    });

    return { success: true, data: reasonType };
  } catch (error) {
    console.error("Error creating call reason type:", error);
    return { success: false, error: "Failed to create call reason type" };
  }
}

// Update a call reason type
export async function updateCallReasonType(
  id: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.callReasonType.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Call reason type not found" };
    }

    const reasonType = await db.callReasonType.update({
      where: { id },
      data: { label },
    });

    return { success: true, data: reasonType };
  } catch (error) {
    console.error("Error updating call reason type:", error);
    return { success: false, error: "Failed to update call reason type" };
  }
}

// Delete a call reason type
export async function deleteCallReasonType(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.callReasonType.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Call reason type not found" };
    }

    await db.callReasonType.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting call reason type:", error);
    return { success: false, error: "Failed to delete call reason type" };
  }
}

// Create a call reason
export async function createCallReason(
  reasonTypeId: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Verify reason type belongs to account
    const reasonType = await db.callReasonType.findFirst({
      where: { id: reasonTypeId, accountId },
    });

    if (!reasonType) {
      return { success: false, error: "Call reason type not found" };
    }

    const reason = await db.callReason.create({
      data: { reasonTypeId, label },
    });

    return { success: true, data: reason };
  } catch (error) {
    console.error("Error creating call reason:", error);
    return { success: false, error: "Failed to create call reason" };
  }
}

// Update a call reason
export async function updateCallReason(
  id: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.callReason.findFirst({
      where: { id },
      include: { reasonType: true },
    });

    if (!existing || existing.reasonType.accountId !== accountId) {
      return { success: false, error: "Call reason not found" };
    }

    const reason = await db.callReason.update({
      where: { id },
      data: { label },
    });

    return { success: true, data: reason };
  } catch (error) {
    console.error("Error updating call reason:", error);
    return { success: false, error: "Failed to update call reason" };
  }
}

// Delete a call reason
export async function deleteCallReason(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.callReason.findFirst({
      where: { id },
      include: { reasonType: true },
    });

    if (!existing || existing.reasonType.accountId !== accountId) {
      return { success: false, error: "Call reason not found" };
    }

    await db.callReason.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting call reason:", error);
    return { success: false, error: "Failed to delete call reason" };
  }
}
