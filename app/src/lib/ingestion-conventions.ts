/**
 * Ingestion Conventions — standardized source/kind pairs and payload schemas
 * for external record ingestion into Monica CRM.
 *
 * All agents (CLI, MCP, API) pushing data into Monica MUST use these
 * conventions. Free-form source/kind values are rejected at validation time.
 *
 * Design principle: Monica is the storage/display layer. Agents curate and
 * push data in; Monica validates structure but does not fetch externally.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Sources — the platform where the data originates
// ---------------------------------------------------------------------------

export const SOURCES = [
  "email",
  "telegram",
  "linkedin",
  "todoist",
  "notion",
  "zoom",
  "phone",
  "whatsapp",
  "manual",
  "other",
] as const;

export type Source = (typeof SOURCES)[number];

export const sourceSchema = z.enum(SOURCES);

// ---------------------------------------------------------------------------
// Kinds — the type of content being stored
// ---------------------------------------------------------------------------

export const KINDS = [
  "message",
  "thread",
  "profile",
  "note",
  "transcript",
  "task",
  "page",
  "meeting",
  "reference",
  "snippet",
] as const;

export type Kind = (typeof KINDS)[number];

export const kindSchema = z.enum(KINDS);

// ---------------------------------------------------------------------------
// Valid source → kind mappings
// Not every combination is valid. This table defines what makes sense.
// ---------------------------------------------------------------------------

export const VALID_SOURCE_KINDS: Record<Source, readonly Kind[]> = {
  email: ["message", "thread", "snippet", "reference"],
  telegram: ["message", "profile", "snippet", "reference"],
  linkedin: ["profile", "message", "reference"],
  todoist: ["task", "reference"],
  notion: ["page", "note", "reference"],
  zoom: ["meeting", "transcript", "reference"],
  phone: ["transcript", "reference"],
  whatsapp: ["message", "snippet", "reference"],
  manual: KINDS, // manual entry allows any kind
  other: KINDS, // escape hatch — any kind is valid
};

/**
 * Check whether a source/kind pair is valid.
 */
export function isValidSourceKind(source: Source, kind: Kind): boolean {
  const allowed = VALID_SOURCE_KINDS[source];
  return allowed.includes(kind);
}

// ---------------------------------------------------------------------------
// Per-adapter metadata schemas
// These define the expected shape of the `metadata` JSON field for each
// source/kind combination. Metadata is optional but when present must conform.
// ---------------------------------------------------------------------------

/** Email message / thread metadata */
export const emailMetadataSchema = z
  .object({
    messageId: z.string().optional(),
    threadId: z.string().optional(),
    subject: z.string().optional(),
    from: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    cc: z.union([z.string(), z.array(z.string())]).optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    provider: z.string().optional(), // gmail, outlook, etc.
  })
  .passthrough();

/** Telegram metadata */
export const telegramMetadataSchema = z
  .object({
    chatId: z.union([z.string(), z.number()]).optional(),
    chatTitle: z.string().optional(),
    messageId: z.union([z.string(), z.number()]).optional(),
    username: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
  })
  .passthrough();

/** LinkedIn metadata */
export const linkedinMetadataSchema = z
  .object({
    profileUrl: z.string().url().optional(),
    headline: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    connectionDegree: z.enum(["1st", "2nd", "3rd"]).optional(),
  })
  .passthrough();

/** Todoist task metadata */
export const todoistMetadataSchema = z
  .object({
    taskId: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    priority: z.number().int().min(1).max(4).optional(),
    labels: z.array(z.string()).optional(),
    dueDate: z.string().optional(),
    completed: z.boolean().optional(),
  })
  .passthrough();

/** Notion page/note metadata */
export const notionMetadataSchema = z
  .object({
    pageId: z.string().optional(),
    databaseId: z.string().optional(),
    workspaceName: z.string().optional(),
    parentPageTitle: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

/** Zoom meeting / transcript metadata */
export const zoomMetadataSchema = z
  .object({
    meetingId: z.string().optional(),
    topic: z.string().optional(),
    duration: z.number().optional(), // minutes
    participants: z.array(z.string()).optional(),
    recordingUrl: z.string().url().optional(),
  })
  .passthrough();

/** Phone transcript metadata */
export const phoneMetadataSchema = z
  .object({
    phoneNumber: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    duration: z.number().optional(), // seconds
    carrier: z.string().optional(),
  })
  .passthrough();

/** WhatsApp metadata */
export const whatsappMetadataSchema = z
  .object({
    chatId: z.string().optional(),
    messageId: z.string().optional(),
    phoneNumber: z.string().optional(),
    groupName: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
  })
  .passthrough();

/** Generic metadata — used for manual/other */
export const genericMetadataSchema = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------------------
// Metadata schema lookup by source
// ---------------------------------------------------------------------------

export const METADATA_SCHEMAS: Record<Source, z.ZodTypeAny> = {
  email: emailMetadataSchema,
  telegram: telegramMetadataSchema,
  linkedin: linkedinMetadataSchema,
  todoist: todoistMetadataSchema,
  notion: notionMetadataSchema,
  zoom: zoomMetadataSchema,
  phone: phoneMetadataSchema,
  whatsapp: whatsappMetadataSchema,
  manual: genericMetadataSchema,
  other: genericMetadataSchema,
};

/**
 * Get the metadata schema for a given source.
 */
export function getMetadataSchema(source: Source): z.ZodTypeAny {
  return METADATA_SCHEMAS[source];
}

// ---------------------------------------------------------------------------
// Full external record validation schema (for create operations)
// ---------------------------------------------------------------------------

export const createExternalRecordSchema = z
  .object({
    contactId: z.string().min(1, "Contact ID is required"),
    source: sourceSchema,
    kind: kindSchema,
    externalId: z.string().nullish(),
    url: z.string().url("Invalid URL format").nullish(),
    title: z.string().nullish(),
    content: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    happenedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .refine(
    (data) => {
      // At least one of url, title, content, or externalId must be present
      return !!(data.url || data.title || data.content || data.externalId);
    },
    {
      message: "At least one of url, title, content, or externalId is required",
      path: ["title"],
    }
  )
  .refine(
    (data) => {
      return isValidSourceKind(data.source, data.kind);
    },
    {
      message: "Invalid source/kind combination",
      path: ["kind"],
    }
  );

export type CreateExternalRecordInput = z.infer<typeof createExternalRecordSchema>;

// ---------------------------------------------------------------------------
// Update schema (partial, source/kind remain required if present)
// ---------------------------------------------------------------------------

export const updateExternalRecordSchema = z
  .object({
    source: sourceSchema.optional(),
    kind: kindSchema.optional(),
    externalId: z.string().nullish(),
    url: z.string().url("Invalid URL format").nullish(),
    title: z.string().nullish(),
    content: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    happenedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .refine(
    (data) => {
      // If both source and kind are provided, validate the combination
      if (data.source && data.kind) {
        return isValidSourceKind(data.source, data.kind);
      }
      return true;
    },
    {
      message: "Invalid source/kind combination",
      path: ["kind"],
    }
  );

export type UpdateExternalRecordInput = z.infer<typeof updateExternalRecordSchema>;

// ---------------------------------------------------------------------------
// Validate metadata against source-specific schema
// Returns validated metadata or null if no metadata provided
// ---------------------------------------------------------------------------

export function validateMetadata(
  source: Source,
  metadata: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  if (metadata === null || metadata === undefined) {
    return { success: true, data: {} };
  }

  const schema = getMetadataSchema(source);
  const result = schema.safeParse(metadata);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return { success: false, error: `Invalid metadata for source "${source}": ${path}${issue?.message}` };
  }

  return { success: true, data: result.data as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Human-readable labels for UI display
// ---------------------------------------------------------------------------

export const SOURCE_LABELS: Record<Source, string> = {
  email: "Email",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  todoist: "Todoist",
  notion: "Notion",
  zoom: "Zoom",
  phone: "Phone",
  whatsapp: "WhatsApp",
  manual: "Manual",
  other: "Other",
};

export const KIND_LABELS: Record<Kind, string> = {
  message: "Message",
  thread: "Thread",
  profile: "Profile",
  note: "Note",
  transcript: "Transcript",
  task: "Task",
  page: "Page",
  meeting: "Meeting",
  reference: "Reference",
  snippet: "Snippet",
};

/**
 * Get the list of valid kinds for a given source (for UI dropdowns).
 */
export function getValidKindsForSource(source: Source): Kind[] {
  return [...VALID_SOURCE_KINDS[source]];
}
