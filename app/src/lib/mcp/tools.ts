import { z } from "zod";
import { db } from "@/lib/db";
import { ApiAuthContext } from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";
import {
  sourceSchema,
  kindSchema,
  isValidSourceKind,
  validateMetadata,
  type Source,
  SOURCES,
  KINDS,
} from "@/lib/ingestion-conventions";

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "UNKNOWN_TOOL"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class ToolError extends Error {
  code: ToolErrorCode;
  status: number;

  constructor(message: string, code: ToolErrorCode, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function normalizeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid arguments";
  }

  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

function dateFromString(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ToolError("Invalid datetime value", "VALIDATION_ERROR", 400);
  }
  return date;
}

async function getAccessibleVaultIds(userId: string): Promise<string[]> {
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });

  return userVaults.map((userVault) => userVault.vaultId);
}

async function getScopedContactOrThrow(contactId: string, auth: ApiAuthContext) {
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
      vault: {
        users: {
          some: { userId: auth.userId },
        },
      },
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
    throw new ToolError("Contact not found", "NOT_FOUND", 404);
  }

  return contact;
}

const isoDatetimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid datetime string",
  });

const searchContactsSchema = z.object({
  query: z.string().min(1),
});

const getContactSchema = z.object({
  contactId: z.string().min(1),
});

const createContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
  vaultId: z.string().min(1).optional(),
});

const updateContactSchema = z
  .object({
    contactId: z.string().min(1),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    nickname: z.string().min(1).optional(),
    jobPosition: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.nickname !== undefined ||
      value.jobPosition !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

const addNoteSchema = z.object({
  contactId: z.string().min(1),
  body: z.string().min(1),
  title: z.string().min(1).optional(),
});

const logActivitySchema = z.object({
  contactId: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1).optional(),
  happenedAt: isoDatetimeSchema.optional(),
});

const listTasksSchema = z.object({
  contactId: z.string().min(1).optional(),
  completed: z.boolean().optional(),
});

const createTaskSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  dueAt: isoDatetimeSchema.optional(),
});

const listRecordsSchema = z.object({
  contactId: z.string().min(1),
});

const addRecordSchema = z
  .object({
    contactId: z.string().min(1),
    source: sourceSchema,
    kind: kindSchema,
    externalId: z.string().min(1).optional(),
    url: z.string().url().optional(),
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    happenedAt: isoDatetimeSchema.optional(),
  })
  .refine(
    (value) =>
      value.externalId !== undefined ||
      value.url !== undefined ||
      value.title !== undefined ||
      value.content !== undefined,
    {
      message: "At least one of externalId, url, title, or content must be provided",
    }
  )
  .refine(
    (value) => isValidSourceKind(value.source, value.kind),
    {
      message: "Invalid source/kind combination",
      path: ["kind"],
    }
  );

const updateTaskSchema = z
  .object({
    taskId: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    completed: z.boolean().optional(),
    dueAt: isoDatetimeSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.completed !== undefined ||
      value.dueAt !== undefined,
    {
      message: "At least one updatable field must be provided",
    }
  );

export interface ToolDefinition<TArgs> {
  description: string;
  ability: string;
  parameters: JsonSchema;
  schema: z.ZodType<TArgs>;
  execute: (
    auth: ApiAuthContext,
    args: TArgs,
    meta: RequestMetadata
  ) => Promise<unknown>;
}

export function defineTool<TArgs>(tool: ToolDefinition<TArgs>): ToolDefinition<TArgs> {
  return tool;
}

export const toolDefinitions = {
  monica_search_contacts: defineTool({
    description: "Search contacts by name or nickname in accessible vaults.",
    ability: "contacts:read",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    schema: searchContactsSchema,
    execute: async (auth, args) => {
      const vaultIds = await getAccessibleVaultIds(auth.userId);
      if (vaultIds.length === 0) {
        return [];
      }

      const contacts = await db.contact.findMany({
        where: {
          vaultId: { in: vaultIds },
          deletedAt: null,
          OR: [
            { firstName: { contains: args.query, mode: "insensitive" } },
            { lastName: { contains: args.query, mode: "insensitive" } },
            { nickname: { contains: args.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          jobPosition: true,
          companyId: true,
        },
        take: 50,
      });

      return contacts;
    },
  }),
  monica_get_contact: defineTool({
    description: "Get a single contact with related details and counts.",
    ability: "contacts:read",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID." },
      },
      required: ["contactId"],
      additionalProperties: false,
    },
    schema: getContactSchema,
    execute: async (auth, args) => {
      const contact = await db.contact.findFirst({
        where: {
          id: args.contactId,
          deletedAt: null,
          vault: {
            users: {
              some: { userId: auth.userId },
            },
          },
        },
        include: {
          gender: true,
          company: true,
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              notes: true,
              activities: true,
              tasks: true,
              calls: true,
            },
          },
        },
      });

      if (!contact) {
        throw new ToolError("Contact not found", "NOT_FOUND", 404);
      }

      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        nickname: contact.nickname,
        jobPosition: contact.jobPosition,
        companyId: contact.companyId,
        gender: contact.gender,
        company: contact.company,
        tags: contact.tags.map((item) => item.tag),
        _count: contact._count,
      };
    },
  }),
  monica_create_contact: defineTool({
    description: "Create a new contact in an accessible vault.",
    ability: "contacts:write",
    parameters: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        nickname: { type: "string" },
        vaultId: { type: "string" },
      },
      required: ["firstName"],
      additionalProperties: false,
    },
    schema: createContactSchema,
    execute: async (auth, args, meta) => {
      const vaultIds = await getAccessibleVaultIds(auth.userId);
      if (vaultIds.length === 0) {
        throw new ToolError("No accessible vault found", "NOT_FOUND", 404);
      }

      const selectedVaultId = args.vaultId ?? vaultIds[0];
      if (!vaultIds.includes(selectedVaultId)) {
        throw new ToolError("Vault is not accessible", "FORBIDDEN", 403);
      }

      const contact = await db.contact.create({
        data: {
          vaultId: selectedVaultId,
          firstName: args.firstName,
          lastName: args.lastName ?? null,
          nickname: args.nickname ?? null,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.CONTACT_CREATED,
        objects: {
          entityId: contact.id,
          entityName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
          entityType: "contact",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: contact.id,
        ...meta,
      });

      return contact;
    },
  }),
  monica_update_contact: defineTool({
    description: "Update basic fields for an existing contact.",
    ability: "contacts:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        nickname: { type: "string" },
        jobPosition: { type: "string" },
      },
      required: ["contactId"],
      additionalProperties: false,
    },
    schema: updateContactSchema,
    execute: async (auth, args, meta) => {
      await getScopedContactOrThrow(args.contactId, auth);

      const updatedContact = await db.contact.update({
        where: { id: args.contactId },
        data: {
          firstName: args.firstName,
          lastName: args.lastName,
          nickname: args.nickname,
          jobPosition: args.jobPosition,
          lastUpdatedAt: new Date(),
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.CONTACT_UPDATED,
        objects: {
          entityId: updatedContact.id,
          entityName: [updatedContact.firstName, updatedContact.lastName]
            .filter(Boolean)
            .join(" "),
          entityType: "contact",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: updatedContact.id,
        ...meta,
      });

      return updatedContact;
    },
  }),
  monica_add_note: defineTool({
    description: "Attach a note to a contact.",
    ability: "notes:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        body: { type: "string" },
        title: { type: "string" },
      },
      required: ["contactId", "body"],
      additionalProperties: false,
    },
    schema: addNoteSchema,
    execute: async (auth, args, meta) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      const note = await db.note.create({
        data: {
          contactId: contact.id,
          vaultId: contact.vaultId,
          title: args.title ?? null,
          body: args.body,
          authorId: auth.userId,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.NOTE_CREATED,
        objects: {
          entityId: note.id,
          entityName: note.title || note.body,
          entityType: "note",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: note.contactId,
        ...meta,
      });

      return note;
    },
  }),
  monica_log_activity: defineTool({
    description: "Log an activity for a contact.",
    ability: "activities:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
        happenedAt: { type: "string", format: "date-time" },
      },
      required: ["contactId", "summary"],
      additionalProperties: false,
    },
    schema: logActivitySchema,
    execute: async (auth, args, meta) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      const activity = await db.activity.create({
        data: {
          contactId: contact.id,
          vaultId: contact.vaultId,
          summary: args.summary,
          description: args.description ?? null,
          happenedAt: args.happenedAt ? dateFromString(args.happenedAt) : null,
          authorId: auth.userId,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.ACTIVITY_CREATED,
        objects: {
          entityId: activity.id,
          entityName: activity.summary || "Activity",
          entityType: "activity",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: activity.contactId,
        ...meta,
      });

      return activity;
    },
  }),
  monica_list_tasks: defineTool({
    description: "List tasks scoped to accessible vaults.",
    ability: "tasks:read",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        completed: { type: "boolean" },
      },
      additionalProperties: false,
    },
    schema: listTasksSchema,
    execute: async (auth, args) => {
      const vaultIds = await getAccessibleVaultIds(auth.userId);
      if (vaultIds.length === 0) {
        return [];
      }

      const tasks = await db.contactTask.findMany({
        where: {
          contact: {
            vaultId: { in: vaultIds },
            deletedAt: null,
          },
          contactId: args.contactId,
          completed: args.completed,
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
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      });

      return tasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        completed: task.completed,
        completedAt: task.completedAt,
        dueAt: task.dueAt,
        contact: task.contact,
      }));
    },
  }),
  monica_create_task: defineTool({
    description: "Create a task for a contact.",
    ability: "tasks:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        dueAt: { type: "string", format: "date-time" },
      },
      required: ["contactId", "name"],
      additionalProperties: false,
    },
    schema: createTaskSchema,
    execute: async (auth, args, meta) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      const task = await db.contactTask.create({
        data: {
          contactId: contact.id,
          name: args.name,
          description: args.description ?? null,
          dueAt: args.dueAt ? dateFromString(args.dueAt) : null,
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
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.TASK_CREATED,
        objects: {
          entityId: task.id,
          entityName: task.name,
          entityType: "task",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: task.contactId,
        ...meta,
      });

      return {
        id: task.id,
        name: task.name,
        description: task.description,
        completed: task.completed,
        completedAt: task.completedAt,
        dueAt: task.dueAt,
        contact: task.contact,
      };
    },
  }),
  monica_list_records: defineTool({
    description: "List external records for a contact.",
    ability: "notes:read",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
      },
      required: ["contactId"],
      additionalProperties: false,
    },
    schema: listRecordsSchema,
    execute: async (auth, args) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      const records = await db.externalRecord.findMany({
        where: { contactId: contact.id },
        orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
      });

      return records;
    },
  }),
  monica_add_record: defineTool({
    description:
      "Add an external record to a contact. Valid sources: " +
      SOURCES.join(", ") +
      ". Valid kinds: " +
      KINDS.join(", ") +
      ". Not all source/kind combinations are valid.",
    ability: "notes:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        source: { type: "string", enum: [...SOURCES] },
        kind: { type: "string", enum: [...KINDS] },
        externalId: { type: "string" },
        url: { type: "string", format: "uri" },
        title: { type: "string" },
        content: { type: "string" },
        metadata: { type: "object" },
        happenedAt: { type: "string", format: "date-time" },
      },
      required: ["contactId", "source", "kind"],
      additionalProperties: false,
    },
    schema: addRecordSchema,
    execute: async (auth, args) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      // Validate metadata against source-specific schema
      if (args.metadata) {
        const metaResult = validateMetadata(args.source as Source, args.metadata);
        if (!metaResult.success) {
          throw new ToolError(metaResult.error, "VALIDATION_ERROR", 400);
        }
      }

      const record = await db.externalRecord.create({
        data: {
          contactId: contact.id,
          source: args.source,
          kind: args.kind,
          externalId: args.externalId ?? null,
          url: args.url ?? null,
          title: args.title ?? null,
          content: args.content ?? null,
          metadata: args.metadata
            ? (args.metadata as Record<string, string | number | boolean | null>)
            : undefined,
          happenedAt: args.happenedAt ? dateFromString(args.happenedAt) : null,
        },
      });

      return record;
    },
  }),
  monica_update_task: defineTool({
    description: "Update task details and completion status.",
    ability: "tasks:write",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        completed: { type: "boolean" },
        dueAt: { type: "string", format: "date-time" },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
    schema: updateTaskSchema,
    execute: async (auth, args, meta) => {
      const existingTask = await db.contactTask.findFirst({
        where: {
          id: args.taskId,
          contact: {
            deletedAt: null,
            vault: {
              users: {
                some: { userId: auth.userId },
              },
            },
          },
        },
      });

      if (!existingTask) {
        throw new ToolError("Task not found", "NOT_FOUND", 404);
      }

      const data: {
        name?: string;
        description?: string;
        completed?: boolean;
        completedAt?: Date | null;
        dueAt?: Date | null;
      } = {};

      if (args.name !== undefined) {
        data.name = args.name;
      }
      if (args.description !== undefined) {
        data.description = args.description;
      }
      if (args.dueAt !== undefined) {
        data.dueAt = dateFromString(args.dueAt);
      }
      if (args.completed !== undefined) {
        data.completed = args.completed;
        if (args.completed && !existingTask.completed) {
          data.completedAt = new Date();
        } else if (!args.completed) {
          data.completedAt = null;
        }
      }

      const task = await db.contactTask.update({
        where: { id: args.taskId },
        data,
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
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.TASK_UPDATED,
        objects: {
          entityId: task.id,
          entityName: task.name,
          entityType: "task",
        },
        userId: auth.userId,
        accountId: auth.accountId,
        contactId: task.contactId,
        ...meta,
      });

      return {
        id: task.id,
        name: task.name,
        description: task.description,
        completed: task.completed,
        completedAt: task.completedAt,
        dueAt: task.dueAt,
        contact: task.contact,
      };
    },
  }),
} as const;

export type ToolName = keyof typeof toolDefinitions;

export function isToolName(tool: string): tool is ToolName {
  return tool in toolDefinitions;
}

export async function executeToolByName(
  tool: ToolName,
  auth: ApiAuthContext,
  rawArguments: unknown,
  meta: RequestMetadata
): Promise<unknown> {
  const def = toolDefinitions[tool];
  const argsResult = def.schema.safeParse(rawArguments ?? {});
  if (!argsResult.success) {
    throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
  }

  // The schema and execute for a given tool are always paired within the same
  // definition, so this call is runtime-safe even though the union type of
  // `def` across all tools prevents TypeScript from narrowing it directly.
  return (
    def.execute as (
      auth: ApiAuthContext,
      args: unknown,
      meta: RequestMetadata
    ) => Promise<unknown>
  )(auth, argsResult.data, meta);
}

export function listToolsMeta(): Array<{
  name: ToolName;
  description: string;
  parameters: JsonSchema;
}> {
  return (Object.keys(toolDefinitions) as ToolName[]).map((name) => ({
    name,
    description: toolDefinitions[name].description,
    parameters: toolDefinitions[name].parameters,
  }));
}
