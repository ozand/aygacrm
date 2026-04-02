"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
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

  return { userId: session.user.id, vault: userVault.vault, accountId: userVault.vault.accountId };
}

// Get or create contact information type
async function getOrCreateContactInfoType(accountId: string, type: string, name: string) {
  let infoType = await db.contactInformationType.findFirst({
    where: { accountId, type },
  });

  if (!infoType) {
    infoType = await db.contactInformationType.create({
      data: { accountId, type, name, protocol: type === "email" ? "mailto:" : "tel:" },
    });
  }

  return infoType;
}

// Get or create important date type
async function getOrCreateDateType(accountId: string, name: string) {
  let dateType = await db.contactImportantDateType.findFirst({
    where: { accountId, name: { equals: name, mode: "insensitive" } },
  });

  if (!dateType) {
    dateType = await db.contactImportantDateType.create({
      data: { accountId, name },
    });
  }

  return dateType;
}

// Import contacts from CSV
export async function importContactsFromCSV(csvContent: string): Promise<ImportResult> {
  const { vault, accountId } = await getUserVaultAndAccount();
  
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const lines = parseCSV(csvContent);
    
    if (lines.length < 2) {
      return { ...result, success: false, errors: ["CSV file is empty or has no data rows"] };
    }

    const headers = lines[0].map((h) => h.toLowerCase().trim());
    const dataRows = lines.slice(1);

    // Map common header names to our fields
    const headerMap = {
      firstName: findHeader(headers, ["first name", "firstname", "given name", "givenname"]),
      lastName: findHeader(headers, ["last name", "lastname", "family name", "familyname", "surname"]),
      middleName: findHeader(headers, ["middle name", "middlename"]),
      nickname: findHeader(headers, ["nickname", "nick name"]),
      prefix: findHeader(headers, ["prefix", "title", "name prefix"]),
      suffix: findHeader(headers, ["suffix", "name suffix"]),
      jobTitle: findHeader(headers, ["job title", "jobtitle", "title", "position", "job position"]),
      company: findHeader(headers, ["company", "organization", "org", "company name"]),
      email1: findHeader(headers, ["email", "e-mail", "email address", "primary email", "email (primary)"]),
      email2: findHeader(headers, ["email 2", "secondary email", "email (secondary)", "other email"]),
      phone1: findHeader(headers, ["phone", "telephone", "mobile", "cell", "phone (primary)", "primary phone"]),
      phone2: findHeader(headers, ["phone 2", "phone (secondary)", "home phone", "work phone"]),
      address: findHeader(headers, ["address", "street", "street address", "address (home)"]),
      city: findHeader(headers, ["city"]),
      state: findHeader(headers, ["state", "province", "state/province", "region"]),
      postalCode: findHeader(headers, ["postal code", "postalcode", "zip", "zip code", "zipcode"]),
      country: findHeader(headers, ["country"]),
      birthday: findHeader(headers, ["birthday", "birth date", "birthdate", "date of birth"]),
    };

    // Get or create contact info types
    const emailType = await getOrCreateContactInfoType(accountId, "email", "Email");
    const phoneType = await getOrCreateContactInfoType(accountId, "phone", "Phone");
    const birthdayType = await getOrCreateDateType(accountId, "Birthday");

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      try {
        const firstName = getValue(row, headerMap.firstName);
        const lastName = getValue(row, headerMap.lastName);
        const nickname = getValue(row, headerMap.nickname);

        // Skip if no identifying info
        if (!firstName && !lastName && !nickname) {
          result.skipped++;
          continue;
        }

        // Create contact
        const contact = await db.contact.create({
          data: {
            firstName: firstName || null,
            lastName: lastName || null,
            middleName: getValue(row, headerMap.middleName) || null,
            nickname: nickname || null,
            prefix: getValue(row, headerMap.prefix) || null,
            suffix: getValue(row, headerMap.suffix) || null,
            jobPosition: getValue(row, headerMap.jobTitle) || null,
            vaultId: vault.id,
            listed: true,
            canBeDeleted: true,
          },
        });

        // Add emails
        const email1 = getValue(row, headerMap.email1);
        const email2 = getValue(row, headerMap.email2);
        
        if (email1) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: emailType.id, data: email1 },
          });
        }
        if (email2) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: emailType.id, data: email2 },
          });
        }

        // Add phones
        const phone1 = getValue(row, headerMap.phone1);
        const phone2 = getValue(row, headerMap.phone2);
        
        if (phone1) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: phoneType.id, data: phone1 },
          });
        }
        if (phone2) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: phoneType.id, data: phone2 },
          });
        }

        // Add birthday
        const birthdayStr = getValue(row, headerMap.birthday);
        if (birthdayStr) {
          const parsedDate = parseDate(birthdayStr);
          if (parsedDate) {
            await db.contactImportantDate.create({
              data: {
                contactId: contact.id,
                typeId: birthdayType.id,
                day: parsedDate.day,
                month: parsedDate.month,
                year: parsedDate.year,
              },
            });
          }
        }

        result.imported++;
      } catch (error) {
        result.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    revalidatePath("/contacts");
    return result;
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : "Failed to parse CSV"],
    };
  }
}

// Import contacts from vCard
export async function importContactsFromVCard(vcfContent: string): Promise<ImportResult> {
  const { vault, accountId } = await getUserVaultAndAccount();
  
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const vcards = parseVCards(vcfContent);

    if (vcards.length === 0) {
      return { ...result, success: false, errors: ["No valid vCards found in file"] };
    }

    // Get or create contact info types
    const emailType = await getOrCreateContactInfoType(accountId, "email", "Email");
    const phoneType = await getOrCreateContactInfoType(accountId, "phone", "Phone");
    const birthdayType = await getOrCreateDateType(accountId, "Birthday");

    for (let i = 0; i < vcards.length; i++) {
      const vcard = vcards[i];

      try {
        // Parse name
        const nField = vcard.N || "";
        const nameParts = nField.split(";");
        const lastName = unescapeVCard(nameParts[0] || "");
        const firstName = unescapeVCard(nameParts[1] || "");
        const middleName = unescapeVCard(nameParts[2] || "");
        const prefix = unescapeVCard(nameParts[3] || "");
        const suffix = unescapeVCard(nameParts[4] || "");

        // Fallback to FN if N is empty
        let displayName = "";
        if (!firstName && !lastName && vcard.FN) {
          displayName = unescapeVCard(vcard.FN);
        }

        if (!firstName && !lastName && !displayName) {
          result.skipped++;
          continue;
        }

        // Create contact
        const contact = await db.contact.create({
          data: {
            firstName: firstName || displayName || null,
            lastName: lastName || null,
            middleName: middleName || null,
            nickname: vcard.NICKNAME ? unescapeVCard(vcard.NICKNAME) : null,
            prefix: prefix || null,
            suffix: suffix || null,
            jobPosition: vcard.TITLE ? unescapeVCard(vcard.TITLE) : null,
            vaultId: vault.id,
            listed: true,
            canBeDeleted: true,
          },
        });

        // Add emails
        const emails = getVCardValues(vcard, "EMAIL");
        for (const email of emails) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: emailType.id, data: email },
          });
        }

        // Add phones
        const phones = getVCardValues(vcard, "TEL");
        for (const phone of phones) {
          await db.contactInformation.create({
            data: { contactId: contact.id, typeId: phoneType.id, data: phone },
          });
        }

        // Add birthday
        if (vcard.BDAY) {
          const parsedDate = parseDate(vcard.BDAY);
          if (parsedDate) {
            await db.contactImportantDate.create({
              data: {
                contactId: contact.id,
                typeId: birthdayType.id,
                day: parsedDate.day,
                month: parsedDate.month,
                year: parsedDate.year,
              },
            });
          }
        }

        result.imported++;
      } catch (error) {
        result.errors.push(`vCard ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    revalidatePath("/contacts");
    return result;
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : "Failed to parse vCard"],
    };
  }
}

// Parse CSV content
function parseCSV(content: string): string[][] {
  const lines: string[][] = [];
  const rows = content.split(/\r?\n/);

  for (const row of rows) {
    if (!row.trim()) continue;

    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    lines.push(cells);
  }

  return lines;
}

// Parse vCards from VCF content
function parseVCards(content: string): Record<string, string>[] {
  const vcards: Record<string, string>[] = [];
  const blocks = content.split(/(?=BEGIN:VCARD)/i);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const vcard: Record<string, string> = {};
    const lines = block.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim() || line.startsWith("BEGIN:") || line.startsWith("END:") || line.startsWith("VERSION:")) {
        continue;
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      let key = line.substring(0, colonIndex).toUpperCase();
      const value = line.substring(colonIndex + 1);

      // Handle properties with parameters (e.g., TEL;TYPE=CELL:...)
      const semicolonIndex = key.indexOf(";");
      if (semicolonIndex !== -1) {
        key = key.substring(0, semicolonIndex);
      }

      // Store multiple values with numeric suffix
      if (vcard[key]) {
        let i = 2;
        while (vcard[`${key}_${i}`]) i++;
        vcard[`${key}_${i}`] = value;
      } else {
        vcard[key] = value;
      }
    }

    if (Object.keys(vcard).length > 0) {
      vcards.push(vcard);
    }
  }

  return vcards;
}

// Get all values for a vCard field (including numbered variants)
function getVCardValues(vcard: Record<string, string>, key: string): string[] {
  const values: string[] = [];
  
  if (vcard[key]) {
    values.push(unescapeVCard(vcard[key]));
  }

  let i = 2;
  while (vcard[`${key}_${i}`]) {
    values.push(unescapeVCard(vcard[`${key}_${i}`]));
    i++;
  }

  return values;
}

// Find matching header index
function findHeader(headers: string[], possibilities: string[]): number {
  for (const p of possibilities) {
    const index = headers.indexOf(p.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

// Get value from row by header index
function getValue(row: string[], index: number): string {
  if (index === -1 || index >= row.length) return "";
  return row[index].trim();
}

// Parse date string to components
function parseDate(dateStr: string): { year: number | null; month: number; day: number } | null {
  if (!dateStr) return null;

  // Try various date formats
  // YYYY-MM-DD
  let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
  }

  // YYYYMMDD
  match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
  }

  // MM/DD/YYYY or DD/MM/YYYY (assume US format)
  match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return { year: parseInt(match[3]), month: parseInt(match[1]), day: parseInt(match[2]) };
  }

  // --MM-DD (no year)
  match = dateStr.match(/^--(\d{2})-(\d{2})$/);
  if (match) {
    return { year: null, month: parseInt(match[1]), day: parseInt(match[2]) };
  }

  return null;
}

// Unescape vCard value
function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
