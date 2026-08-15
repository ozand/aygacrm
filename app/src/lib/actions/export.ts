"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface ExportOptions {
  includeContacts?: boolean;
  includeNotes?: boolean;
  includeActivities?: boolean;
  includeTasks?: boolean;
  includeReminders?: boolean;
  includeGifts?: boolean;
  includeCalls?: boolean;
  includeJournals?: boolean;
  format?: "json" | "csv" | "vcard";
}

interface ExportStats {
  contacts: number;
  notes: number;
  activities: number;
  tasks: number;
  reminders: number;
  gifts: number;
  calls: number;
  journals: number;
}

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

export async function getExportStats(): Promise<ExportStats> {
  const { vault } = await getUserVault();

  const [
    contactCount,
    noteCount,
    activityCount,
    taskCount,
    reminderCount,
    giftCount,
    callCount,
    journalCount,
  ] = await Promise.all([
    db.contact.count({ where: { vaultId: vault.id, deletedAt: null } }),
    db.note.count({ where: { vaultId: vault.id } }),
    db.activity.count({ where: { vaultId: vault.id } }),
    db.contactTask.count({ where: { contact: { vaultId: vault.id } } }),
    db.contactReminder.count({
      where: { importantDate: { contact: { vaultId: vault.id } } },
    }),
    db.gift.count({ where: { contact: { vaultId: vault.id } } }),
    db.call.count({ where: { contact: { vaultId: vault.id } } }),
    db.journal.count({ where: { vaultId: vault.id } }),
  ]);

  return {
    contacts: contactCount,
    notes: noteCount,
    activities: activityCount,
    tasks: taskCount,
    reminders: reminderCount,
    gifts: giftCount,
    calls: callCount,
    journals: journalCount,
  };
}

export async function exportData(
  options: ExportOptions,
): Promise<{ data: string; filename: string; mimeType: string }> {
  const { vault } = await getUserVault();

  // For JSON export, fetch all selected data
  if (options.format === "json") {
    const exportData: any = {};

    if (options.includeContacts) {
      exportData.contacts = await db.contact.findMany({
        where: { vaultId: vault.id, deletedAt: null },
        include: {
          gender: true,
          pronoun: true,
          template: true,
          company: true,
          religion: true,
          addresses: { include: { addressType: true } },
          contactInformation: { include: { type: true } },
          importantDates: { include: { type: true, reminders: true } },
          tasks: true,
          activities: true,
          feedItems: true,
          relationships: { include: { relatedContact: true, relationshipType: true } },
          labels: { include: { label: true } },
          groups: { include: { group: true, role: true } },
          pets: { include: { petCategory: true } },
          goals: { include: { streakEvents: true } },
          gifts: { include: { occasion: true } },
          loans: { include: { loanee: true } },
          loanedTo: { include: { loaner: true } },
          calls: { include: { callReason: true } },
          lifeEvents: { include: { lifeEventType: true } },
          files: true,
          quickFacts: true,
          auditLogs: true,
          tags: { include: { tag: true } },
          moodEvents: { include: { parameter: true } },
        },
      });
    }
    if (options.includeNotes) {
      exportData.notes = await db.note.findMany({
        where: { vaultId: vault.id },
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, emotion: true },
      });
    }
    if (options.includeActivities) {
      exportData.activities = await db.activity.findMany({
        where: { vaultId: vault.id },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      });
    }
    if (options.includeTasks) {
      exportData.tasks = await db.contactTask.findMany({
        where: { contact: { vaultId: vault.id } },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      });
    }
    if (options.includeReminders) {
      exportData.reminders = await db.contactReminder.findMany({
        where: { importantDate: { contact: { vaultId: vault.id } } },
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, importantDate: true },
      });
    }
    if (options.includeGifts) {
      exportData.gifts = await db.gift.findMany({
        where: { contact: { vaultId: vault.id } },
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, occasion: true },
      });
    }
    if (options.includeCalls) {
      exportData.calls = await db.call.findMany({
        where: { contact: { vaultId: vault.id } },
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, callReason: true },
      });
    }
    if (options.includeJournals) {
      exportData.journals = await db.journal.findMany({
        where: { vaultId: vault.id },
        include: {
          posts: {
            include: {
              sections: true,
              metrics: { include: { journalMetric: true } },
              tags: { include: { tag: true } },
              photos: true,
            },
          },
          slices: true,
        },
      });
    }

    const filename = `aygacrm-export-${new Date().toISOString().split("T")[0]}.json`;
    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
      mimeType: "application/json",
    };
  }

  // Handle CSV export (only contacts with basic fields)
  if (options.format === "csv") {
    if (!options.includeContacts) {
      throw new Error("CSV export requires including contacts.");
    }

    const contacts = await db.contact.findMany({
      where: { vaultId: vault.id, deletedAt: null },
      select: {
        firstName: true,
        lastName: true,
        nickname: true,
        jobPosition: true,
        company: { select: { name: true } },
        contactInformation: { where: { type: { type: "email" } }, select: { data: true } },
        importantDates: { where: { type: { name: "Birthday" } }, select: { day: true, month: true, year: true } },
      },
    });

    const headers = [
      "First Name",
      "Last Name",
      "Nickname",
      "Job Position",
      "Company",
      "Email",
      "Birthday",
    ];
    const rows = contacts.map((contact) => [
      contact.firstName || "",
      contact.lastName || "",
      contact.nickname || "",
      contact.jobPosition || "",
      contact.company?.name || "",
      contact.contactInformation[0]?.data || "", // Assuming first email
      contact.importantDates[0] // Assuming first birthday
        ? `${contact.importantDates[0].month}/${contact.importantDates[0].day}/${contact.importantDates[0].year}`
        : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");

    const filename = `aygacrm-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    return {
      data: csvContent,
      filename,
      mimeType: "text/csv",
    };
  }

  // Handle vCard export (only contacts with basic fields)
  if (options.format === "vcard") {
    if (!options.includeContacts) {
      throw new Error("vCard export requires including contacts.");
    }

    const contacts = await db.contact.findMany({
      where: { vaultId: vault.id, deletedAt: null },
      include: {
        company: true,
        contactInformation: { include: { type: true } },
        addresses: true,
        importantDates: { include: { type: true } },
      },
    });

    const vcards = contacts.map((contact) => {
      let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
      vcard += `FN:${contact.firstName || ""} ${contact.lastName || ""}\n`;
      if (contact.nickname) vcard += `NICKNAME:${contact.nickname}\n`;
      if (contact.jobPosition) vcard += `TITLE:${contact.jobPosition}\n`;
      if (contact.company) vcard += `ORG:${contact.company.name}\n`;

      contact.contactInformation.forEach((info) => {
        if (info.type.type === "email") {
          vcard += `EMAIL;TYPE=INTERNET:${info.data}\n`;
        } else if (info.type.type === "phone") {
          vcard += `TEL;TYPE=CELL:${info.data}\n`; // Default to CELL, could be more specific
        }
        // Add more types as needed
      });

      contact.addresses.forEach((address) => {
        const addrParts = [
          address.line1,
          address.line2,
          address.city,
          address.province,
          address.postalCode,
          address.country,
        ].filter(Boolean);
        if (addrParts.length > 0) {
          vcard += `ADR;TYPE=HOME:;;${addrParts.join(";")}\n`; // Default to HOME
        }
      });

      contact.importantDates.forEach((date) => {
        if (date.type?.name === "Birthday" && date.year && date.month && date.day) {
          vcard += `BDAY:${date.year}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}\n`;
        }
      });

      vcard += "END:VCARD\n";
      return vcard;
    });

    const filename = `aygacrm-contacts-${new Date().toISOString().split("T")[0]}.vcf`;
    return {
      data: vcards.join(""),
      filename,
      mimeType: "text/vcard",
    };
  }

  throw new Error("Unsupported export format.");
}
