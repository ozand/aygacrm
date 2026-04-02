"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Helper to get user's account
async function getUserVaultAndAccount() {
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

  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

// ==================== TEMPLATES ====================

export async function getTemplates() {
  const { accountId } = await getUserVaultAndAccount();

  return db.template.findMany({
    where: { accountId },
    include: {
      _count: { select: { pages: true, contacts: true, vaults: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getTemplate(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  return db.template.findFirst({
    where: { id, accountId },
    include: {
      pages: {
        orderBy: { position: "asc" },
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: {
              rows: {
                orderBy: { position: "asc" },
                include: {
                  fields: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      },
      _count: { select: { contacts: true, vaults: true } },
    },
  });
}

export async function createTemplate(data: { name: string }) {
  const { accountId } = await getUserVaultAndAccount();

  const template = await db.template.create({
    data: {
      accountId,
      name: data.name,
    },
  });

  revalidatePath("/settings");
  return template;
}

export async function updateTemplate(id: string, data: { name?: string }) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.template.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw new Error("Template not found");
  }

  const template = await db.template.update({
    where: { id },
    data: { name: data.name },
  });

  revalidatePath("/settings");
  return template;
}

export async function deleteTemplate(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.template.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw new Error("Template not found");
  }

  if (!existing.canBeDeleted) {
    throw new Error("This template cannot be deleted");
  }

  await db.template.delete({ where: { id } });

  revalidatePath("/settings");
  return { success: true };
}

export async function duplicateTemplate(id: string, newName: string) {
  const { accountId } = await getUserVaultAndAccount();

  const original = await db.template.findFirst({
    where: { id, accountId },
    include: {
      pages: {
        include: {
          modules: {
            include: {
              rows: {
                include: { fields: true },
              },
            },
          },
        },
      },
    },
  });

  if (!original) {
    throw new Error("Template not found");
  }

  // Create new template with all nested data
  const newTemplate = await db.template.create({
    data: {
      accountId,
      name: newName,
      pages: {
        create: original.pages.map((page) => ({
          name: page.name,
          slug: page.slug,
          position: page.position,
          modules: {
            create: page.modules.map((module) => ({
              type: module.type,
              position: module.position,
              rows: {
                create: module.rows.map((row) => ({
                  position: row.position,
                  fields: {
                    create: row.fields.map((field) => ({
                      type: field.type,
                      label: field.label,
                      required: field.required,
                      position: field.position,
                    })),
                  },
                })),
              },
            })),
          },
        })),
      },
    },
  });

  revalidatePath("/settings");
  return newTemplate;
}

// ==================== TEMPLATE PAGES ====================

export async function createTemplatePage(
  templateId: string,
  data: { name: string; slug: string }
) {
  const { accountId } = await getUserVaultAndAccount();

  const template = await db.template.findFirst({
    where: { id: templateId, accountId },
    include: { pages: true },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const maxPosition = template.pages.reduce(
    (max, p) => Math.max(max, p.position),
    -1
  );

  const page = await db.templatePage.create({
    data: {
      templateId,
      name: data.name,
      slug: data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      position: maxPosition + 1,
    },
  });

  revalidatePath("/settings");
  return page;
}

export async function updateTemplatePage(
  id: string,
  data: { name?: string; slug?: string; position?: number }
) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.templatePage.findFirst({
    where: { id, template: { accountId } },
  });

  if (!existing) {
    throw new Error("Page not found");
  }

  const page = await db.templatePage.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug?.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      position: data.position,
    },
  });

  revalidatePath("/settings");
  return page;
}

export async function deleteTemplatePage(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.templatePage.findFirst({
    where: { id, template: { accountId } },
  });

  if (!existing) {
    throw new Error("Page not found");
  }

  if (!existing.canBeDeleted) {
    throw new Error("This page cannot be deleted");
  }

  await db.templatePage.delete({ where: { id } });

  revalidatePath("/settings");
  return { success: true };
}

// ==================== MODULES ====================

// Available module types
export const MODULE_TYPES = [
  { type: "notes", label: "Notes", description: "Contact notes" },
  { type: "activities", label: "Activities", description: "Logged activities and interactions" },
  { type: "reminders", label: "Reminders", description: "Important date reminders" },
  { type: "tasks", label: "Tasks", description: "Tasks related to contact" },
  { type: "calls", label: "Calls", description: "Call history" },
  { type: "gifts", label: "Gifts", description: "Gift ideas and history" },
  { type: "debts", label: "Debts/Loans", description: "Money owed or lent" },
  { type: "documents", label: "Documents", description: "Attached files" },
  { type: "photos", label: "Photos", description: "Photo gallery" },
  { type: "relationships", label: "Relationships", description: "Family and friend connections" },
  { type: "pets", label: "Pets", description: "Contact's pets" },
  { type: "addresses", label: "Addresses", description: "Physical addresses" },
  { type: "contact_info", label: "Contact Information", description: "Email, phone, social" },
  { type: "important_dates", label: "Important Dates", description: "Birthdays, anniversaries" },
  { type: "life_events", label: "Life Events", description: "Major life milestones" },
  { type: "goals", label: "Goals", description: "Personal goals" },
  { type: "hobbies", label: "Hobbies", description: "Interests and activities" },
  { type: "work", label: "Work Info", description: "Job and company details" },
  { type: "quick_facts", label: "Quick Facts", description: "Key information at a glance" },
] as const;

export async function createModule(
  templatePageId: string,
  data: { type: string }
) {
  const { accountId } = await getUserVaultAndAccount();

  const page = await db.templatePage.findFirst({
    where: { id: templatePageId, template: { accountId } },
    include: { modules: true },
  });

  if (!page) {
    throw new Error("Page not found");
  }

  const maxPosition = page.modules.reduce(
    (max, m) => Math.max(max, m.position),
    -1
  );

  const module = await db.module.create({
    data: {
      templatePageId,
      type: data.type,
      position: maxPosition + 1,
    },
  });

  revalidatePath("/settings");
  return module;
}

export async function updateModule(
  id: string,
  data: { type?: string; position?: number }
) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.module.findFirst({
    where: { id, templatePage: { template: { accountId } } },
  });

  if (!existing) {
    throw new Error("Module not found");
  }

  const module = await db.module.update({
    where: { id },
    data: {
      type: data.type,
      position: data.position,
    },
  });

  revalidatePath("/settings");
  return module;
}

export async function deleteModule(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  const existing = await db.module.findFirst({
    where: { id, templatePage: { template: { accountId } } },
  });

  if (!existing) {
    throw new Error("Module not found");
  }

  if (!existing.canBeDeleted) {
    throw new Error("This module cannot be deleted");
  }

  await db.module.delete({ where: { id } });

  revalidatePath("/settings");
  return { success: true };
}

export async function reorderModules(
  templatePageId: string,
  moduleIds: string[]
) {
  const { accountId } = await getUserVaultAndAccount();

  const page = await db.templatePage.findFirst({
    where: { id: templatePageId, template: { accountId } },
  });

  if (!page) {
    throw new Error("Page not found");
  }

  // Update positions
  await Promise.all(
    moduleIds.map((id, index) =>
      db.module.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  revalidatePath("/settings");
  return { success: true };
}

// ==================== SEED DEFAULT TEMPLATE ====================

export async function seedDefaultTemplate() {
  const { accountId } = await getUserVaultAndAccount();

  const existingCount = await db.template.count({
    where: { accountId },
  });

  if (existingCount > 0) {
    return { success: true, data: { message: "Template already exists" } };
  }

  // Create default template with standard pages and modules
  const template = await db.template.create({
    data: {
      accountId,
      name: "Default",
      canBeDeleted: false,
      pages: {
        create: [
          {
            name: "Overview",
            slug: "overview",
            position: 0,
            canBeDeleted: false,
            modules: {
              create: [
                { type: "quick_facts", position: 0, canBeDeleted: false },
                { type: "contact_info", position: 1 },
                { type: "important_dates", position: 2 },
                { type: "relationships", position: 3 },
              ],
            },
          },
          {
            name: "Activities",
            slug: "activities",
            position: 1,
            modules: {
              create: [
                { type: "notes", position: 0 },
                { type: "activities", position: 1 },
                { type: "calls", position: 2 },
              ],
            },
          },
          {
            name: "Life",
            slug: "life",
            position: 2,
            modules: {
              create: [
                { type: "life_events", position: 0 },
                { type: "work", position: 1 },
                { type: "pets", position: 2 },
                { type: "hobbies", position: 3 },
              ],
            },
          },
          {
            name: "Gifts & Loans",
            slug: "gifts",
            position: 3,
            modules: {
              create: [
                { type: "gifts", position: 0 },
                { type: "debts", position: 1 },
              ],
            },
          },
          {
            name: "Files",
            slug: "files",
            position: 4,
            modules: {
              create: [
                { type: "documents", position: 0 },
                { type: "photos", position: 1 },
              ],
            },
          },
          {
            name: "Tasks & Goals",
            slug: "tasks",
            position: 5,
            modules: {
              create: [
                { type: "tasks", position: 0 },
                { type: "goals", position: 1 },
                { type: "reminders", position: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  revalidatePath("/settings");
  return { success: true, data: template };
}

// Get or create default template for a vault
export async function getDefaultTemplate() {
  const { accountId, vault } = await getUserVaultAndAccount();

  // First check if vault has a template assigned
  if (vault.defaultTemplateId) {
    const template = await db.template.findFirst({
      where: { id: vault.defaultTemplateId, accountId },
      include: {
        pages: {
          orderBy: { position: "asc" },
          include: {
            modules: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });
    if (template) return template;
  }

  // Otherwise get/create the default template
  let template = await db.template.findFirst({
    where: { accountId, name: "Default" },
    include: {
      pages: {
        orderBy: { position: "asc" },
        include: {
          modules: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    await seedDefaultTemplate();
    template = await db.template.findFirst({
      where: { accountId, name: "Default" },
      include: {
        pages: {
          orderBy: { position: "asc" },
          include: {
            modules: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });
  }

  return template;
}
