export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
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
    try {
      const body = await request.json();

      const { contact_id, title, body: noteBody, emotion_id } = body;

      if (!contact_id) {
        return apiError("INVALID_PARAMS", 400, "contact_id is required");
      }

      if (!noteBody) {
        return apiError("INVALID_PARAMS", 400, "body is required");
      }

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
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "notes:write"
);
