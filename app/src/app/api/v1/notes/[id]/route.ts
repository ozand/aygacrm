export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody, validateBody } from "@/lib/api/validation";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

const updateNoteSchema = z.object({
  body: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
  emotion_id: z.string().nullable().optional(),
});

// Helper to get a note with access check
async function getNoteWithAccess(noteId: number, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.note.findFirst({
    where: {
      id: noteId,
      vaultId: { in: vaultIds },
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
}

// Transform note to API format
function transformNote(note: NonNullable<Awaited<ReturnType<typeof getNoteWithAccess>>>) {
  return {
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
  };
}

// GET /api/v1/notes/[id] - Get a single note
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const noteId = parseInt(params?.id || "", 10);

    if (isNaN(noteId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid note ID");
    }

    const note = await getNoteWithAccess(noteId, context.userId);

    if (!note) {
      return apiError("NOT_FOUND", 404, "Note not found");
    }

    return apiSuccess(transformNote(note));
  },
  "notes:read"
);

// PUT /api/v1/notes/[id] - Update a note
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const noteId = parseInt(params?.id || "", 10);

    if (isNaN(noteId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid note ID");
    }

    const note = await getNoteWithAccess(noteId, context.userId);

    if (!note) {
      return apiError("NOT_FOUND", 404, "Note not found");
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(updateNoteSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { title, body: noteBody, emotion_id } = validated.data;

    try {

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (title !== undefined) {
        updateData.title = title || null;
      }

      if (noteBody !== undefined) {
        if (!noteBody) {
          return apiError("INVALID_PARAMS", 400, "body cannot be empty");
        }
        updateData.body = noteBody;
      }

      if (emotion_id !== undefined) {
        updateData.emotionId = emotion_id || null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update note
      const updatedNote = await db.note.update({
        where: { id: noteId },
        data: updateData,
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

      return apiSuccess(transformNote(updatedNote));
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "notes:write"
);

// DELETE /api/v1/notes/[id] - Delete a note
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const noteId = parseInt(params?.id || "", 10);

    if (isNaN(noteId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid note ID");
    }

    const note = await getNoteWithAccess(noteId, context.userId);

    if (!note) {
      return apiError("NOT_FOUND", 404, "Note not found");
    }

    // Delete note
    await db.note.delete({
      where: { id: noteId },
    });

    return apiSuccess({ deleted: true, id: noteId });
  },
  "notes:write"
);
