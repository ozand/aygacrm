export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody, validateBody } from "@/lib/api/validation";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  apiPaginated,
  getPaginationParams,
  getSortParams,
  getBaseUrl,
  ApiAuthContext,
} from "@/lib/api/auth";

const createNoteSchema = z.object({
  contact_id: z.string().min(1),
  body: z.string().min(1),
  title: z.string().optional(),
  emotion_id: z.string().optional(),
});

// GET /api/v1/notes - List all notes
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "updatedAt"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");

    // Get user's vaults
    const userVaults = await db.userVault.findMany({
      where: { userId: context.userId },
      select: { vaultId: true },
    });
    const vaultIds = userVaults.map((uv) => uv.vaultId);

    if (vaultIds.length === 0) {
      return apiPaginated([], page, limit, 0, getBaseUrl(request));
    }

    // Build where clause
    const where: Record<string, unknown> = {
      vaultId: { in: vaultIds },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    // Get total count
    const total = await db.note.count({ where });

    // Get notes
    const notes = await db.note.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { createdAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        emotion: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Transform to API format
    const data = notes.map((note) => ({
      id: note.id,
      object: "note",
      title: note.title,
      body: note.body,
      emotion: note.emotion
        ? {
            id: note.emotion.id,
            name: note.emotion.name,
            type: note.emotion.type,
          }
        : null,
      contact: {
        id: note.contact.id,
        object: "contact",
        first_name: note.contact.firstName,
        last_name: note.contact.lastName,
        nickname: note.contact.nickname,
        complete_name: [note.contact.firstName, note.contact.lastName]
          .filter(Boolean)
          .join(" "),
      },
      author: note.author
        ? {
            id: note.author.id,
            name: [note.author.firstName, note.author.lastName]
              .filter(Boolean)
              .join(" "),
          }
        : null,
      created_at: note.createdAt.toISOString(),
      updated_at: note.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "notes:read"
);

// POST /api/v1/notes - Create a note
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(createNoteSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { contact_id, title, body: noteBody, emotion_id } = validated.data;

    try {
      // Verify user has access to the contact
      const contact = await db.contact.findFirst({
        where: {
          id: contact_id,
          deletedAt: null,
          vault: {
            users: {
              some: { userId: context.userId },
            },
          },
        },
        include: {
          vault: { select: { id: true } },
        },
      });

      if (!contact) {
        return apiError("NOT_FOUND", 404, "Contact not found");
      }

      // Create note
      const note = await db.note.create({
        data: {
          contactId: contact_id,
          vaultId: contact.vault.id,
          authorId: context.userId,
          title: title || null,
          body: noteBody,
          emotionId: emotion_id || null,
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

      return apiSuccess(
        {
          id: note.id,
          object: "note",
          title: note.title,
          body: note.body,
          contact: {
            id: note.contact.id,
            object: "contact",
            first_name: note.contact.firstName,
            last_name: note.contact.lastName,
            nickname: note.contact.nickname,
          },
          created_at: note.createdAt.toISOString(),
          updated_at: note.updatedAt.toISOString(),
        },
        201
      );
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "notes:write"
);
