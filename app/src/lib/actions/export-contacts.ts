"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

// Get all contacts with full data for export
async function getContactsForExport() {
  const { vault } = await getUserVault();

  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      deletedAt: null,
      listed: true,
      canBeDeleted: true,
    },
    include: {
      contactInformation: {
        include: { type: true },
      },
      addresses: {
        include: { addressType: true },
      },
      importantDates: {
        include: { type: true },
      },
      company: true,
      labels: {
        include: { label: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return contacts;
}

// Export contacts to CSV format
export async function exportContactsToCSV(): Promise<string> {
  const contacts = await getContactsForExport();

  // CSV Headers
  const headers = [
    "First Name",
    "Last Name",
    "Middle Name",
    "Nickname",
    "Prefix",
    "Suffix",
    "Job Title",
    "Company",
    "Email (Primary)",
    "Email (Secondary)",
    "Phone (Primary)",
    "Phone (Secondary)",
    "Address (Home)",
    "City",
    "State/Province",
    "Postal Code",
    "Country",
    "Birthday",
    "Labels",
    "Notes",
  ];

  const rows: string[][] = [];

  for (const contact of contacts) {
    // Extract emails
    const emails = contact.contactInformation
      .filter((ci) => ci.type.type === "email")
      .map((ci) => ci.data);

    // Extract phones
    const phones = contact.contactInformation
      .filter((ci) => ci.type.type === "phone")
      .map((ci) => ci.data);

    // Extract primary address
    const primaryAddress = contact.addresses[0];

    // Extract birthday
    const birthday = contact.importantDates.find(
      (d) => d.type?.name?.toLowerCase() === "birthday"
    );
    const birthdayStr = birthday
      ? formatDate(birthday.year, birthday.month, birthday.day)
      : "";

    // Extract labels
    const labels = contact.labels.map((l) => l.label.name).join("; ");

    const row = [
      contact.firstName || "",
      contact.lastName || "",
      contact.middleName || "",
      contact.nickname || "",
      contact.prefix || "",
      contact.suffix || "",
      contact.jobPosition || "",
      contact.company?.name || "",
      emails[0] || "",
      emails[1] || "",
      phones[0] || "",
      phones[1] || "",
      primaryAddress?.line1 || "",
      primaryAddress?.city || "",
      primaryAddress?.province || "",
      primaryAddress?.postalCode || "",
      primaryAddress?.country || "",
      birthdayStr,
      labels,
      "", // Notes would need separate query
    ];

    rows.push(row);
  }

  // Build CSV string
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  return csvContent;
}

// Export contacts to vCard format (VCF)
export async function exportContactsToVCard(): Promise<string> {
  const contacts = await getContactsForExport();

  const vcards: string[] = [];

  for (const contact of contacts) {
    const vcard = buildVCard(contact);
    vcards.push(vcard);
  }

  return vcards.join("\n");
}

// Export single contact to vCard
export async function exportContactToVCard(contactId: string): Promise<string | null> {
  const { vault } = await getUserVault();

  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      vaultId: vault.id,
      deletedAt: null,
    },
    include: {
      contactInformation: {
        include: { type: true },
      },
      addresses: {
        include: { addressType: true },
      },
      importantDates: {
        include: { type: true },
      },
      company: true,
      labels: {
        include: { label: true },
      },
    },
  });

  if (!contact) {
    return null;
  }

  return buildVCard(contact);
}

// Build vCard string for a contact
function buildVCard(contact: {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  nickname: string | null;
  prefix: string | null;
  suffix: string | null;
  jobPosition: string | null;
  company: { name: string } | null;
  contactInformation: Array<{ type: { type: string }; data: string }>;
  addresses: Array<{
    addressType: { name: string } | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string | null;
  }>;
  importantDates: Array<{
    type: { name: string } | null;
    year: number | null;
    month: number | null;
    day: number | null;
  }>;
}): string {
  const lines: string[] = [];

  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");

  // Full name
  const fullName = [
    contact.prefix,
    contact.firstName,
    contact.middleName,
    contact.lastName,
    contact.suffix,
  ]
    .filter(Boolean)
    .join(" ");
  lines.push(`FN:${escapeVCard(fullName || "Unknown")}`);

  // Structured name: Family;Given;Additional;Prefix;Suffix
  lines.push(
    `N:${escapeVCard(contact.lastName || "")};${escapeVCard(contact.firstName || "")};${escapeVCard(contact.middleName || "")};${escapeVCard(contact.prefix || "")};${escapeVCard(contact.suffix || "")}`
  );

  // Nickname
  if (contact.nickname) {
    lines.push(`NICKNAME:${escapeVCard(contact.nickname)}`);
  }

  // Organization and title
  if (contact.company?.name) {
    lines.push(`ORG:${escapeVCard(contact.company.name)}`);
  }
  if (contact.jobPosition) {
    lines.push(`TITLE:${escapeVCard(contact.jobPosition)}`);
  }

  // Emails
  for (const ci of contact.contactInformation) {
    if (ci.type.type === "email") {
      lines.push(`EMAIL:${escapeVCard(ci.data)}`);
    }
  }

  // Phones
  for (const ci of contact.contactInformation) {
    if (ci.type.type === "phone") {
      lines.push(`TEL:${escapeVCard(ci.data)}`);
    }
  }

  // Addresses
  for (const addr of contact.addresses) {
    const type = addr.addressType?.name?.toUpperCase() || "HOME";
    // ADR: PO Box;Extended;Street;City;Region;Postal;Country
    lines.push(
      `ADR;TYPE=${type}:;;${escapeVCard(addr.line1 || "")};${escapeVCard(addr.city || "")};${escapeVCard(addr.province || "")};${escapeVCard(addr.postalCode || "")};${escapeVCard(addr.country || "")}`
    );
  }

  // Birthday
  const birthday = contact.importantDates.find(
    (d) => d.type?.name?.toLowerCase() === "birthday"
  );
  if (birthday && birthday.year && birthday.month && birthday.day) {
    const bday = `${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`;
    lines.push(`BDAY:${bday}`);
  }

  lines.push("END:VCARD");

  return lines.join("\r\n");
}

// Helper: Escape CSV value
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Helper: Escape vCard value
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Helper: Format date
function formatDate(
  year: number | null,
  month: number | null,
  day: number | null
): string {
  if (!month || !day) return "";
  const parts = [];
  if (year) parts.push(year);
  parts.push(String(month).padStart(2, "0"));
  parts.push(String(day).padStart(2, "0"));
  return parts.join("-");
}
