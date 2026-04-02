"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createAuditLog } from "./audit";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";

// Get user's vault and account
async function getUserVaultAndAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) throw new Error("No vault found");
  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

export interface ImportResult {
  success: boolean;
  imported: {
    contacts: number;
    notes: number;
    activities: number;
    tasks: number;
    gifts: number;
    calls: number;
    journals: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ImportOptions {
  skipExisting?: boolean; // Skip contacts with matching names
  dryRun?: boolean; // Don't actually import, just validate
}

interface ExportedContact {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  middleName?: string;
  maidenName?: string;
  suffix?: string;
  prefix?: string;
  company?: string;
  jobTitle?: string;
  background?: string;
  addresses?: Array<{
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    isActive?: boolean;
  }>;
  contactInformation?: Array<{
    type?: string;
    data?: string;
  }>;
  importantDates?: Array<{
    label?: string;
    day?: number;
    month?: number;
    year?: number;
    type?: string;
  }>;
  quickFacts?: Array<{
    label?: string;
    value?: string;
  }>;
  pets?: Array<{
    name?: string;
    category?: string;
  }>;
  tags?: string[];
}

interface ExportedNote {
  title?: string;
  body: string;
  contact?: string;
}

interface ExportedActivity {
  summary: string;
  description?: string;
  happenedAt?: string;
  contact?: string;
}

interface ExportedTask {
  label: string;
  description?: string;
  completed?: boolean;
  completedAt?: string;
  dueAt?: string;
  contact?: string;
}

interface ExportedGift {
  name: string;
  description?: string;
  amount?: number;
  currency?: string;
  url?: string;
  status?: string;
  date?: string;
  occasion?: string;
  contact?: string;
}

interface ExportedCall {
  calledAt: string;
  duration?: number;
  description?: string;
  callReason?: string;
  contact?: string;
}

interface ExportedJournal {
  name: string;
  description?: string;
  entries?: Array<{
    title?: string;
    content?: string;
    writtenAt?: string;
    sections?: Array<{
      label?: string;
      content?: string;
    }>;
  }>;
}

interface ImportData {
  version?: string;
  exportedAt?: string;
  contacts?: ExportedContact[];
  notes?: ExportedNote[];
  activities?: ExportedActivity[];
  tasks?: ExportedTask[];
  gifts?: ExportedGift[];
  calls?: ExportedCall[];
  journals?: ExportedJournal[];
}

/**
 * Validate import data structure
 */
function validateImportData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push("Invalid data format: expected JSON object");
    return { valid: false, errors };
  }

  const importData = data as ImportData;

  // Check for at least some data to import
  const hasData =
    (importData.contacts && importData.contacts.length > 0) ||
    (importData.notes && importData.notes.length > 0) ||
    (importData.activities && importData.activities.length > 0) ||
    (importData.tasks && importData.tasks.length > 0) ||
    (importData.gifts && importData.gifts.length > 0) ||
    (importData.calls && importData.calls.length > 0) ||
    (importData.journals && importData.journals.length > 0);

  if (!hasData) {
    errors.push("No data to import");
    return { valid: false, errors };
  }

  // Validate contacts structure
  if (importData.contacts) {
    importData.contacts.forEach((c, i) => {
      if (!c.firstName && !c.lastName && !c.nickname) {
        errors.push(`Contact #${i + 1}: Must have at least firstName, lastName, or nickname`);
      }
    });
  }

  // Validate notes
  if (importData.notes) {
    importData.notes.forEach((n, i) => {
      if (!n.body) {
        errors.push(`Note #${i + 1}: Must have body text`);
      }
    });
  }

  // Validate tasks
  if (importData.tasks) {
    importData.tasks.forEach((t, i) => {
      if (!t.label) {
        errors.push(`Task #${i + 1}: Must have label`);
      }
    });
  }

  // Validate gifts
  if (importData.gifts) {
    importData.gifts.forEach((g, i) => {
      if (!g.name) {
        errors.push(`Gift #${i + 1}: Must have name`);
      }
    });
  }

  // Validate journals
  if (importData.journals) {
    importData.journals.forEach((j, i) => {
      if (!j.name) {
        errors.push(`Journal #${i + 1}: Must have name`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Import data from JSON export
 */
export async function importData(
  jsonData: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { userId, vault, accountId } = await getUserVaultAndAccount();
  const { skipExisting = true, dryRun = false } = options;

  const result: ImportResult = {
    success: false,
    imported: {
      contacts: 0,
      notes: 0,
      activities: 0,
      tasks: 0,
      gifts: 0,
      calls: 0,
      journals: 0,
    },
    errors: [],
    warnings: [],
  };

  // Parse JSON
  let data: ImportData;
  try {
    data = JSON.parse(jsonData);
  } catch {
    result.errors.push("Invalid JSON format");
    return result;
  }

  // Validate
  const validation = validateImportData(data);
  if (!validation.valid) {
    result.errors = validation.errors;
    return result;
  }

  if (dryRun) {
    result.success = true;
    result.imported = {
      contacts: data.contacts?.length || 0,
      notes: data.notes?.length || 0,
      activities: data.activities?.length || 0,
      tasks: data.tasks?.length || 0,
      gifts: data.gifts?.length || 0,
      calls: data.calls?.length || 0,
      journals: data.journals?.length || 0,
    };
    return result;
  }

  // Map to track imported contacts by name for linking
  const contactMap = new Map<string, string>(); // "firstName lastName" -> contactId

  // Get existing contacts for skip/link logic
  const existingContacts = await db.contact.findMany({
    where: { vaultId: vault.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  for (const c of existingContacts) {
    const key = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
    if (key) contactMap.set(key, c.id);
  }

  // Get or create contact information types
  const contactInfoTypes = await db.contactInformationType.findMany({
    where: { accountId },
  });
  const typeMap = new Map(contactInfoTypes.map((t) => [t.name.toLowerCase(), t.id]));

  // Get tags
  const existingTags = await db.tag.findMany({
    where: { accountId },
  });
  const tagMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));

  // Get pet categories
  const petCategories = await db.petCategory.findMany({
    where: { accountId },
  });
  const petCategoryMap = new Map(petCategories.map((c) => [c.name.toLowerCase(), c.id]));

  // Get gift occasions
  const giftOccasions = await db.giftOccasion.findMany({
    where: { accountId },
  });
  const occasionMap = new Map(giftOccasions.map((o) => [o.label.toLowerCase(), o.id]));

  // Get call reasons (with their type)
  const callReasons = await db.callReason.findMany({
    include: { reasonType: true },
  });
  const reasonMap = new Map(callReasons.map((r) => [r.label.toLowerCase(), r.id]));

  try {
    // Import contacts
    if (data.contacts) {
      for (const c of data.contacts) {
        const contactName = `${c.firstName || ""} ${c.lastName || ""}`.trim();
        const contactKey = contactName.toLowerCase();

        // Skip if exists and skipExisting is true
        if (skipExisting && contactMap.has(contactKey)) {
          result.warnings.push(`Skipped existing contact: ${contactName}`);
          continue;
        }

        try {
          // Create contact
          const contact = await db.contact.create({
            data: {
              firstName: c.firstName,
              lastName: c.lastName,
              nickname: c.nickname,
              middleName: c.middleName,
              maidenName: c.maidenName,
              suffix: c.suffix,
              prefix: c.prefix,
              vaultId: vault.id,
              listed: true,
              canBeDeleted: true,
            },
          });

          contactMap.set(contactKey, contact.id);
          result.imported.contacts++;

          // Import addresses
          if (c.addresses) {
            for (const addr of c.addresses) {
              await db.address.create({
                data: {
                  line1: addr.line1,
                  line2: addr.line2,
                  city: addr.city,
                  province: addr.province,
                  postalCode: addr.postalCode,
                  country: addr.country,
                  isActive: addr.isActive ?? true,
                  contactId: contact.id,
                },
              });
            }
          }

          // Import contact information
          if (c.contactInformation) {
            for (const ci of c.contactInformation) {
              if (!ci.data) continue;
              const typeId = ci.type ? typeMap.get(ci.type.toLowerCase()) : null;
              if (typeId) {
                await db.contactInformation.create({
                  data: {
                    data: ci.data,
                    typeId,
                    contactId: contact.id,
                  },
                });
              }
            }
          }

          // Import quick facts
          if (c.quickFacts) {
            for (const qf of c.quickFacts) {
              if (!qf.label || !qf.value) continue;
              await db.contactQuickFact.create({
                data: {
                  label: qf.label,
                  value: qf.value,
                  contactId: contact.id,
                },
              });
            }
          }

          // Import pets
          if (c.pets) {
            for (const pet of c.pets) {
              if (!pet.name) continue;
              const petCategoryId = pet.category
                ? petCategoryMap.get(pet.category.toLowerCase())
                : null;
              await db.pet.create({
                data: {
                  name: pet.name,
                  petCategoryId: petCategoryId || null,
                  contactId: contact.id,
                },
              });
            }
          }

          // Import tags
          if (c.tags) {
            for (const tagName of c.tags) {
              let tagId = tagMap.get(tagName.toLowerCase());
              if (!tagId) {
                // Create tag if it doesn't exist
                const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                const newTag = await db.tag.create({
                  data: {
                    name: tagName,
                    slug,
                    accountId,
                  },
                });
                tagId = newTag.id;
                tagMap.set(tagName.toLowerCase(), tagId);
              }
              await db.contactTag.create({
                data: {
                  contactId: contact.id,
                  tagId,
                },
              });
            }
          }
        } catch (err) {
          result.errors.push(
            `Failed to import contact "${contactName}": ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }
    }

    // Helper to find contact by name
    function findContactId(contactName?: string): string | null {
      if (!contactName) return null;
      return contactMap.get(contactName.toLowerCase()) || null;
    }

    // Get first contact as fallback (for notes/activities that require a contact)
    const firstContactId = contactMap.values().next().value || null;

    // Import notes
    if (data.notes) {
      for (const n of data.notes) {
        const contactId = findContactId(n.contact) || firstContactId;
        if (!contactId) {
          result.warnings.push(`Skipped note (no contact found): "${n.title || n.body.substring(0, 30)}..."`);
          continue;
        }

        try {
          await db.note.create({
            data: {
              title: n.title,
              body: n.body,
              contactId,
              vaultId: vault.id,
              authorId: userId,
            },
          });
          result.imported.notes++;
        } catch (err) {
          result.errors.push(
            `Failed to import note: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }

    // Import activities
    if (data.activities) {
      for (const a of data.activities) {
        const contactId = findContactId(a.contact) || firstContactId;
        if (!contactId) {
          result.warnings.push(`Skipped activity (no contact found): "${a.summary}"`);
          continue;
        }

        try {
          await db.activity.create({
            data: {
              summary: a.summary,
              description: a.description,
              happenedAt: a.happenedAt ? new Date(a.happenedAt) : new Date(),
              contactId,
              vaultId: vault.id,
              authorId: userId,
            },
          });
          result.imported.activities++;
        } catch (err) {
          result.errors.push(
            `Failed to import activity: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }

    // Import tasks
    if (data.tasks) {
      for (const t of data.tasks) {
        const contactId = findContactId(t.contact) || firstContactId;
        if (!contactId) {
          result.warnings.push(`Skipped task (no contact found): "${t.label}"`);
          continue;
        }

        try {
          await db.contactTask.create({
            data: {
              name: t.label,
              description: t.description,
              completed: t.completed || false,
              completedAt: t.completedAt ? new Date(t.completedAt) : null,
              dueAt: t.dueAt ? new Date(t.dueAt) : null,
              contactId,
            },
          });
          result.imported.tasks++;
        } catch (err) {
          result.errors.push(
            `Failed to import task: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }

    // Import gifts
    if (data.gifts) {
      for (const g of data.gifts) {
        const contactId = findContactId(g.contact) || firstContactId;
        if (!contactId) {
          result.warnings.push(`Skipped gift (no contact found): "${g.name}"`);
          continue;
        }

        try {
          const occasionId = g.occasion
            ? occasionMap.get(g.occasion.toLowerCase()) || null
            : null;

          await db.gift.create({
            data: {
              name: g.name,
              description: g.description,
              amount: g.amount,
              currency: g.currency,
              url: g.url,
              status: g.status || "idea",
              date: g.date ? new Date(g.date) : null,
              occasionId,
              contactId,
            },
          });
          result.imported.gifts++;
        } catch (err) {
          result.errors.push(
            `Failed to import gift: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }

    // Import calls
    if (data.calls) {
      for (const c of data.calls) {
        const contactId = findContactId(c.contact) || firstContactId;
        if (!contactId) {
          result.warnings.push(`Skipped call (no contact found)`);
          continue;
        }

        try {
          const reasonId = c.callReason
            ? reasonMap.get(c.callReason.toLowerCase()) || null
            : null;

          await db.call.create({
            data: {
              calledAt: new Date(c.calledAt),
              duration: c.duration,
              description: c.description,
              callReasonId: reasonId,
              contactId,
            },
          });
          result.imported.calls++;
        } catch (err) {
          result.errors.push(
            `Failed to import call: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }

    // Import journals
    if (data.journals) {
      for (const j of data.journals) {
        try {
          const journal = await db.journal.create({
            data: {
              name: j.name,
              description: j.description,
              vaultId: vault.id,
            },
          });
          result.imported.journals++;

          // Import entries
          if (j.entries) {
            for (const entry of j.entries) {
              const post = await db.post.create({
                data: {
                  title: entry.title,
                  content: entry.content,
                  writtenAt: entry.writtenAt ? new Date(entry.writtenAt) : new Date(),
                  journalId: journal.id,
                },
              });

              // Import sections
              if (entry.sections) {
                for (const section of entry.sections) {
                  if (!section.label) continue;
                  await db.postSection.create({
                    data: {
                      label: section.label,
                      content: section.content,
                      postId: post.id,
                    },
                  });
                }
              }
            }
          }
        } catch (err) {
          result.errors.push(
            `Failed to import journal "${j.name}": ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }
    }

    result.success = result.errors.length === 0;

    // Create audit log
    await createAuditLog({
      action: AUDIT_ACTIONS.CONTACT_CREATED,
      objects: {
        entityType: "import",
        entityName: `Imported data: ${result.imported.contacts} contacts, ${result.imported.notes} notes, ${result.imported.activities} activities, ${result.imported.tasks} tasks, ${result.imported.gifts} gifts, ${result.imported.calls} calls, ${result.imported.journals} journals`,
      },
    });
  } catch (err) {
    result.errors.push(
      `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  return result;
}

/**
 * Preview import data without actually importing
 */
export async function previewImport(jsonData: string): Promise<{
  valid: boolean;
  counts: {
    contacts: number;
    notes: number;
    activities: number;
    tasks: number;
    gifts: number;
    calls: number;
    journals: number;
  };
  errors: string[];
}> {
  const errors: string[] = [];

  let data: ImportData;
  try {
    data = JSON.parse(jsonData);
  } catch {
    return {
      valid: false,
      counts: {
        contacts: 0,
        notes: 0,
        activities: 0,
        tasks: 0,
        gifts: 0,
        calls: 0,
        journals: 0,
      },
      errors: ["Invalid JSON format"],
    };
  }

  const validation = validateImportData(data);
  if (!validation.valid) {
    return {
      valid: false,
      counts: {
        contacts: 0,
        notes: 0,
        activities: 0,
        tasks: 0,
        gifts: 0,
        calls: 0,
        journals: 0,
      },
      errors: validation.errors,
    };
  }

  // Count journal entries
  let journalEntries = 0;
  if (data.journals) {
    for (const j of data.journals) {
      journalEntries += j.entries?.length || 0;
    }
  }

  return {
    valid: true,
    counts: {
      contacts: data.contacts?.length || 0,
      notes: data.notes?.length || 0,
      activities: data.activities?.length || 0,
      tasks: data.tasks?.length || 0,
      gifts: data.gifts?.length || 0,
      calls: data.calls?.length || 0,
      journals: data.journals?.length || 0,
    },
    errors,
  };
}
