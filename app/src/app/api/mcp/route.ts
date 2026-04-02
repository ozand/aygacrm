export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiAuthContext, hasAbility, validateApiToken } from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type ToolErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "UNKNOWN_TOOL"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

class ToolError extends Error {
  code: ToolErrorCode;
  status: number;

  constructor(message: string, code: ToolErrorCode, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function errorResponse(message: string, code: ToolErrorCode, status: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code,
      },
    },
    { status }
  );
}

function normalizeZodError(error: z.ZodError): string {
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

function getRequestMetadata(request: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
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
    source: z.string().min(1),
    kind: z.string().min(1),
    externalId: z.string().min(1).optional(),
    url: z.string().url().optional(),
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
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

interface ToolDefinition<TArgs> {
  description: string;
  ability: string;
  parameters: JsonSchema;
  schema: z.ZodType<TArgs>;
  execute: (
    auth: ApiAuthContext,
    args: TArgs,
    request: NextRequest
  ) => Promise<unknown>;
}

function defineTool<TArgs>(tool: ToolDefinition<TArgs>): ToolDefinition<TArgs> {
  return tool;
}

const toolDefinitions = {
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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
    description: "Add an external record to a contact.",
    ability: "notes:write",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        source: { type: "string" },
        kind: { type: "string" },
        externalId: { type: "string" },
        url: { type: "string", format: "uri" },
        title: { type: "string" },
        content: { type: "string" },
        happenedAt: { type: "string", format: "date-time" },
      },
      required: ["contactId", "source", "kind"],
      additionalProperties: false,
    },
    schema: addRecordSchema,
    execute: async (auth, args) => {
      const contact = await getScopedContactOrThrow(args.contactId, auth);

      const record = await db.externalRecord.create({
        data: {
          contactId: contact.id,
          source: args.source,
          kind: args.kind,
          externalId: args.externalId ?? null,
          url: args.url ?? null,
          title: args.title ?? null,
          content: args.content ?? null,
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
    execute: async (auth, args, request) => {
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

      const requestMetadata = getRequestMetadata(request);
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
        ...requestMetadata,
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

type ToolName = keyof typeof toolDefinitions;

function isToolName(tool: string): tool is ToolName {
  return tool in toolDefinitions;
}

async function executeToolByName(
  tool: ToolName,
  auth: ApiAuthContext,
  rawArguments: Record<string, unknown>,
  request: NextRequest
): Promise<unknown> {
  switch (tool) {
    case "monica_search_contacts": {
      const argsResult = toolDefinitions.monica_search_contacts.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_search_contacts.execute(auth, argsResult.data, request);
    }
    case "monica_get_contact": {
      const argsResult = toolDefinitions.monica_get_contact.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_get_contact.execute(auth, argsResult.data, request);
    }
    case "monica_create_contact": {
      const argsResult = toolDefinitions.monica_create_contact.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_create_contact.execute(auth, argsResult.data, request);
    }
    case "monica_update_contact": {
      const argsResult = toolDefinitions.monica_update_contact.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_update_contact.execute(auth, argsResult.data, request);
    }
    case "monica_add_note": {
      const argsResult = toolDefinitions.monica_add_note.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_add_note.execute(auth, argsResult.data, request);
    }
    case "monica_log_activity": {
      const argsResult = toolDefinitions.monica_log_activity.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_log_activity.execute(auth, argsResult.data, request);
    }
    case "monica_list_tasks": {
      const argsResult = toolDefinitions.monica_list_tasks.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_list_tasks.execute(auth, argsResult.data, request);
    }
    case "monica_create_task": {
      const argsResult = toolDefinitions.monica_create_task.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_create_task.execute(auth, argsResult.data, request);
    }
    case "monica_list_records": {
      const argsResult = toolDefinitions.monica_list_records.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_list_records.execute(auth, argsResult.data, request);
    }
    case "monica_add_record": {
      const argsResult = toolDefinitions.monica_add_record.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_add_record.execute(auth, argsResult.data, request);
    }
    case "monica_update_task": {
      const argsResult = toolDefinitions.monica_update_task.schema.safeParse(rawArguments);
      if (!argsResult.success) {
        throw new ToolError(normalizeZodError(argsResult.error), "VALIDATION_ERROR", 400);
      }
      return toolDefinitions.monica_update_task.execute(auth, argsResult.data, request);
    }
  }
}

const requestSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "monica-crm",
    version: "1.0.0",
    tools: (Object.keys(toolDefinitions) as ToolName[]).map((name) => ({
      name,
      description: toolDefinitions[name].description,
      parameters: toolDefinitions[name].parameters,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authContext = await validateApiToken(request);
  if (!authContext) {
    return errorResponse("Unauthorized", "UNAUTHORIZED", 401);
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    const bodyResult = requestSchema.safeParse(json);

    if (!bodyResult.success) {
      return errorResponse(normalizeZodError(bodyResult.error), "INVALID_REQUEST", 400);
    }

    parsedBody = bodyResult.data;
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_REQUEST", 400);
  }

  if (!isToolName(parsedBody.tool)) {
    return errorResponse("Unknown tool", "UNKNOWN_TOOL", 400);
  }

  const definition = toolDefinitions[parsedBody.tool];

  if (!hasAbility(authContext, definition.ability)) {
    return errorResponse("Insufficient permissions", "FORBIDDEN", 403);
  }

  try {
    const result = await executeToolByName(
      parsedBody.tool,
      authContext,
      parsedBody.arguments,
      request
    );
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ToolError) {
      return errorResponse(error.message, error.code, error.status);
    }

    console.error("MCP route error:", error);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}
