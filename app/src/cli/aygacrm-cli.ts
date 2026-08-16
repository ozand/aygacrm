#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import {
  SOURCES,
  KINDS,
  isValidSourceKind,
  type Source,
  type Kind,
} from "../lib/ingestion-conventions.js";
import { upsertExternalRecord } from "../lib/external-record-upsert.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const db = new PrismaClient();

type TaskRow = {
  id: string;
  name: string;
  completed: boolean;
  dueAt: Date | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
  };
};

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.toISOString().split("T")[0];
}

function shortId(id: string | number): string {
  return String(id).slice(0, 8);
}

function contactDisplayName(contact: {
  firstName: string | null;
  lastName: string | null;
  nickname?: string | null;
}): string {
  const full = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  if (full.length > 0) {
    return full;
  }
  if (contact.nickname) {
    return contact.nickname;
  }
  return "(no name)";
}

function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("No results.");
    return;
  }

  const widths = headers.map((header, i) => {
    const maxCell = rows.reduce((max, row) => Math.max(max, (row[i] ?? "").length), header.length);
    return maxCell;
  });

  const headerLine = headers.map((header, i) => header.padEnd(widths[i])).join("  ");
  const dividerLine = widths.map((width) => "-".repeat(width)).join("  ");

  console.log(headerLine);
  console.log(dividerLine);
  for (const row of rows) {
    console.log(row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  "));
  }
}

function getFlag(args: string[], name: string): string | undefined {
  const key = `--${name}`;
  const index = args.indexOf(key);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }
  return value;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

async function getFirstVault() {
  const userVault = await db.userVault.findFirst({
    select: { vaultId: true },
    orderBy: { createdAt: "asc" },
  });

  if (userVault) {
    return db.vault.findUnique({ where: { id: userVault.vaultId } });
  }

  return db.vault.findFirst({ orderBy: { createdAt: "asc" } });
}

async function resolveContactId(vaultId: string, inputId: string): Promise<string> {
  const exact = await db.contact.findFirst({
    where: { id: inputId, vaultId, deletedAt: null },
    select: { id: true },
  });

  if (exact) {
    return exact.id;
  }

  const matches = await db.contact.findMany({
    where: {
      id: { startsWith: inputId },
      vaultId,
      deletedAt: null,
    },
    select: { id: true },
    take: 2,
  });

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    throw new Error(`Ambiguous contact id prefix: ${inputId}`);
  }

  throw new Error(`Contact not found: ${inputId}`);
}

function printUsage(): void {
  console.log("AygaCRM CLI");
  console.log("");
  console.log("Usage:");
  console.log("  contacts list [--query <search>] [--limit <n>]");
  console.log("  contacts get <id>");
  console.log("  contacts search <query>");
  console.log("  notes add <contactId> --body <text>");
  console.log("  tasks list [--contact <id>] [--completed]");
  console.log("  tasks create <contactId> --name <text> [--due <date>]");
  console.log("  records list <contactId>");
  console.log("  records add <contactId> --source <src> --kind <kind> [--title <text>] [--url <url>] [--content <text>] [--external-id <id>] [--happened-at <date>]");
  console.log("  status");
}

async function runContactsList(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const query = getFlag(args, "query");
  const limitRaw = getFlag(args, "limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }

  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              { nickname: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const rows = contacts.map((contact) => [
    shortId(contact.id),
    contactDisplayName(contact),
    contact.company?.name ?? "-",
    formatDate(contact.updatedAt),
  ]);

  printTable(["ID", "Name", "Company", "Updated"], rows);
}

async function runContactsGet(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const inputId = args[2];
  if (!inputId) {
    throw new Error("Missing contact id");
  }

  const contactId = await resolveContactId(vault.id, inputId);

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id, deletedAt: null },
    include: {
      company: { select: { name: true } },
      importantDates: {
        include: { type: { select: { name: true, type: true } } },
        orderBy: { createdAt: "asc" },
      },
      externalIdentities: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          notes: true,
          tasks: true,
        },
      },
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  console.log(`ID: ${contact.id}`);
  console.log(`Name: ${contactDisplayName(contact)}`);
  console.log(`Job: ${contact.jobPosition ?? "-"}`);
  console.log(`Company: ${contact.company?.name ?? "-"}`);
  console.log(`Created: ${formatDate(contact.createdAt)}`);
  console.log(`Updated: ${formatDate(contact.updatedAt)}`);
  console.log(`Notes: ${contact._count.notes}`);
  console.log(`Tasks: ${contact._count.tasks}`);

  console.log("Dates:");
  if (contact.importantDates.length === 0) {
    console.log("- none");
  } else {
    for (const dateItem of contact.importantDates) {
      const kind = dateItem.type?.name ?? dateItem.type?.type ?? "date";
      const dateValue = [dateItem.year, dateItem.month, dateItem.day]
        .map((part) => (part == null ? "??" : String(part).padStart(2, "0")))
        .join("-");
      console.log(`- ${kind}: ${dateValue}`);
    }
  }

  console.log("External identities:");
  if (contact.externalIdentities.length === 0) {
    console.log("- none");
  } else {
    for (const identity of contact.externalIdentities) {
      const verified = identity.verified ? "verified" : "unverified";
      console.log(`- ${identity.source}: ${identity.externalId} (${verified})`);
    }
  }
}

async function runContactsSearch(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const query = args[2];
  if (!query) {
    throw new Error("Missing search query");
  }

  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { nickname: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const rows = contacts.map((contact) => [
    shortId(contact.id),
    contactDisplayName(contact),
    contact.company?.name ?? "-",
    formatDate(contact.updatedAt),
  ]);

  printTable(["ID", "Name", "Company", "Updated"], rows);
}

async function runNotesAdd(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const inputContactId = args[2];
  if (!inputContactId) {
    throw new Error("Missing contact id");
  }

  const body = getFlag(args, "body");
  if (!body) {
    throw new Error("Missing --body");
  }

  const contactId = await resolveContactId(vault.id, inputContactId);
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
    },
    select: {
      id: true,
      vaultId: true,
      firstName: true,
      lastName: true,
      nickname: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const note = await db.note.create({
    data: {
      contactId: contact.id,
      vaultId: contact.vaultId,
      body,
      title: null,
      authorId: null,
      emotionId: null,
    },
  });

  console.log(`Created note ${note.id} for ${contactDisplayName(contact)}.`);
}

async function runTasksList(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const contactInput = getFlag(args, "contact");
  const completedOnly = hasFlag(args, "completed");

  let contactId: string | undefined;
  if (contactInput) {
    contactId = await resolveContactId(vault.id, contactInput);
  }

  const where: {
    contact: { vaultId: string; deletedAt: null };
    contactId?: string;
    completed?: boolean;
  } = {
    contact: {
      vaultId: vault.id,
      deletedAt: null,
    },
  };

  if (contactId) {
    where.contactId = contactId;
  }
  if (completedOnly) {
    where.completed = true;
  }

  const tasks = await db.contactTask.findMany({
    where,
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
    orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const rows = (tasks as TaskRow[]).map((task) => [
    shortId(task.id),
    task.name,
    contactDisplayName(task.contact),
    formatDate(task.dueAt),
    task.completed ? "yes" : "no",
  ]);

  printTable(["ID", "Name", "Contact", "Due", "Done"], rows);
}

async function runTasksCreate(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const inputContactId = args[2];
  if (!inputContactId) {
    throw new Error("Missing contact id");
  }

  const name = getFlag(args, "name");
  if (!name) {
    throw new Error("Missing --name");
  }

  const dueRaw = getFlag(args, "due");
  let dueAt: Date | null = null;
  if (dueRaw) {
    dueAt = new Date(dueRaw);
    if (Number.isNaN(dueAt.getTime())) {
      throw new Error("Invalid --due date");
    }
  }

  const contactId = await resolveContactId(vault.id, inputContactId);
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const task = await db.contactTask.create({
    data: {
      contactId: contact.id,
      name,
      dueAt,
      description: null,
    },
  });

  console.log(`Created task ${shortId(task.id)} for ${contactDisplayName(contact)}.`);
}

async function runStatus(): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const [totalContacts, totalNotes, pendingTasks, completedTasks, externalIdentities, mergeLogs] =
    await Promise.all([
      db.contact.count({ where: { vaultId: vault.id, deletedAt: null } }),
      db.note.count({ where: { vaultId: vault.id } }),
      db.contactTask.count({ where: { contact: { vaultId: vault.id, deletedAt: null }, completed: false } }),
      db.contactTask.count({ where: { contact: { vaultId: vault.id, deletedAt: null }, completed: true } }),
      db.externalIdentity.count({ where: { contact: { vaultId: vault.id, deletedAt: null } } }),
      db.contactMergeLog.findMany({
        where: {
          OR: [
            { primaryContact: { vaultId: vault.id } },
            { secondaryContact: { vaultId: vault.id } },
          ],
        },
        include: {
          primaryContact: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          secondaryContact: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  console.log(`Vault: ${vault.name} (${vault.id})`);
  console.log(`Contacts: ${totalContacts}`);
  console.log(`Notes: ${totalNotes}`);
  console.log(`Tasks: ${pendingTasks} pending / ${completedTasks} completed`);
  console.log(`External identities: ${externalIdentities}`);
  console.log("Recent merge logs:");

  if (mergeLogs.length === 0) {
    console.log("- none");
    return;
  }

  for (const log of mergeLogs) {
    const primaryName = contactDisplayName(log.primaryContact);
    const secondaryName = contactDisplayName(log.secondaryContact);
    console.log(
      `- ${formatDate(log.createdAt)} ${log.action}: ${primaryName} <- ${secondaryName} (${log.reason ?? "n/a"})`
    );
  }
}

async function runRecordsList(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const inputContactId = args[2];
  if (!inputContactId) {
    throw new Error("Missing contact id");
  }

  const contactId = await resolveContactId(vault.id, inputContactId);

  const records = await db.externalRecord.findMany({
    where: {
      contactId,
      contact: {
        vaultId: vault.id,
        deletedAt: null,
      },
    },
    orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const rows = records.map((record) => [
    shortId(record.id),
    record.source,
    record.kind,
    record.title ?? "-",
    formatDate(record.happenedAt ?? record.createdAt),
    record.url ?? "-",
  ]);

  printTable(["ID", "Source", "Kind", "Title", "Date", "URL"], rows);
}

async function runRecordsAdd(args: string[]): Promise<void> {
  const vault = await getFirstVault();
  if (!vault) {
    console.log("No vault found.");
    return;
  }

  const inputContactId = args[2];
  if (!inputContactId) {
    throw new Error("Missing contact id");
  }

  const source = getFlag(args, "source");
  const kind = getFlag(args, "kind");
  const title = getFlag(args, "title");
  const url = getFlag(args, "url");
  const content = getFlag(args, "content");
  const externalId = getFlag(args, "external-id");
  const happenedAtRaw = getFlag(args, "happened-at");

  if (!source) {
    throw new Error("Missing --source");
  }
  if (!kind) {
    throw new Error("Missing --kind");
  }

  // Validate against ingestion conventions
  if (!SOURCES.includes(source as Source)) {
    throw new Error(`Invalid --source "${source}". Valid: ${SOURCES.join(", ")}`);
  }
  if (!KINDS.includes(kind as Kind)) {
    throw new Error(`Invalid --kind "${kind}". Valid: ${KINDS.join(", ")}`);
  }
  if (!isValidSourceKind(source as Source, kind as Kind)) {
    throw new Error(`Invalid source/kind combination: "${source}/${kind}"`);
  }

  if (!title && !url && !content && !externalId) {
    throw new Error("At least one of --title, --url, --content, or --external-id is required");
  }

  let happenedAt: Date | null = null;
  if (happenedAtRaw) {
    happenedAt = new Date(happenedAtRaw);
    if (Number.isNaN(happenedAt.getTime())) {
      throw new Error("Invalid --happened-at date");
    }
  }

  const contactId = await resolveContactId(vault.id, inputContactId);
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      vaultId: vault.id,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const { record, created } = await upsertExternalRecord(db, {
    contactId: contact.id,
    source,
    kind,
    title: title ?? null,
    url: url ?? null,
    content: content ?? null,
    externalId: externalId ?? null,
    happenedAt,
  });

  console.log(
    `${created ? "Created" : "Updated"} record ${shortId(record.id)} for ${contactDisplayName(contact)}.`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  if (!command) {
    printUsage();
    return;
  }

  if (command === "contacts" && subcommand === "list") {
    await runContactsList(args);
    return;
  }

  if (command === "contacts" && subcommand === "get") {
    await runContactsGet(args);
    return;
  }

  if (command === "contacts" && subcommand === "search") {
    await runContactsSearch(args);
    return;
  }

  if (command === "notes" && subcommand === "add") {
    await runNotesAdd(args);
    return;
  }

  if (command === "tasks" && subcommand === "list") {
    await runTasksList(args);
    return;
  }

  if (command === "tasks" && subcommand === "create") {
    await runTasksCreate(args);
    return;
  }

  if (command === "records" && subcommand === "list") {
    await runRecordsList(args);
    return;
  }

  if (command === "records" && subcommand === "add") {
    await runRecordsAdd(args);
    return;
  }

  if (command === "status") {
    await runStatus();
    return;
  }

  printUsage();
}

main()
  .catch((err: unknown) => {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error("Error: Unknown failure");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
