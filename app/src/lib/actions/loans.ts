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

// Get loans for a contact (both lent and borrowed)
export async function getLoansForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    // Get loans where contact is either loaner or loanee
    const loans = await db.loan.findMany({
      where: {
        OR: [{ loanerId: contactId }, { loaneeId: contactId }],
      },
      include: {
        loaner: {
          select: { id: true, firstName: true, lastName: true },
        },
        loanee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return loans;
  } catch (error) {
    console.error("Error fetching loans:", error);
    return [];
  }
}

// Create a loan
export async function createLoan(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const amountStr = formData.get("amount") as string;
    const currency = formData.get("currency") as string;
    const type = formData.get("type") as string; // lent, borrowed
    const loanedAtStr = formData.get("loanedAt") as string | null;

    if (!contactId || !name || !amountStr || !currency || !type) {
      return { success: false, error: "Name, amount, currency and type are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    // For loans, we need to decide who is loaner and loanee
    // If type is "lent" - user (represented by contact) lent money, so contact is loaner
    // If type is "borrowed" - user borrowed from contact, so contact is loaner
    // For simplicity, we'll use the same contact as both for now (self-tracking)
    // In real app, this would involve another contact or "me" entity

    const loan = await db.loan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        amount: parseFloat(amountStr),
        currency: currency,
        type: type,
        loanedAt: loanedAtStr ? new Date(loanedAtStr) : null,
        loanerId: contactId,
        loaneeId: contactId, // Simplified - in real app would be different
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: loan };
  } catch (error) {
    console.error("Error creating loan:", error);
    return { success: false, error: "Failed to create loan" };
  }
}

// Settle a loan
export async function settleLoan(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify loan belongs to user's vault
    const loan = await db.loan.findFirst({
      where: { id },
      include: { loaner: true, loanee: true },
    });

    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.loaner.vaultId !== vault.id && loan.loanee.vaultId !== vault.id) {
      return { success: false, error: "Loan not found" };
    }

    await db.loan.update({
      where: { id },
      data: { settledAt: new Date() },
    });

    revalidatePath(`/contacts/${loan.loanerId}`);
    revalidatePath(`/contacts/${loan.loaneeId}`);

    return { success: true };
  } catch (error) {
    console.error("Error settling loan:", error);
    return { success: false, error: "Failed to settle loan" };
  }
}

// Reopen a settled loan
export async function reopenLoan(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify loan belongs to user's vault
    const loan = await db.loan.findFirst({
      where: { id },
      include: { loaner: true, loanee: true },
    });

    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.loaner.vaultId !== vault.id && loan.loanee.vaultId !== vault.id) {
      return { success: false, error: "Loan not found" };
    }

    await db.loan.update({
      where: { id },
      data: { settledAt: null },
    });

    revalidatePath(`/contacts/${loan.loanerId}`);
    revalidatePath(`/contacts/${loan.loaneeId}`);

    return { success: true };
  } catch (error) {
    console.error("Error reopening loan:", error);
    return { success: false, error: "Failed to reopen loan" };
  }
}

// Delete a loan
export async function deleteLoan(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify loan belongs to user's vault
    const loan = await db.loan.findFirst({
      where: { id },
      include: { loaner: true, loanee: true },
    });

    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.loaner.vaultId !== vault.id && loan.loanee.vaultId !== vault.id) {
      return { success: false, error: "Loan not found" };
    }

    const contactId = loan.loanerId;

    await db.loan.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting loan:", error);
    return { success: false, error: "Failed to delete loan" };
  }
}
