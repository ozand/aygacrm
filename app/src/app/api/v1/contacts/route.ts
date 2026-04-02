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

// GET /api/v1/contacts - List all contacts
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "updatedAt", "firstName", "lastName"]);
    const url = new URL(request.url);
    const query = url.searchParams.get("query");

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
      deletedAt: null,
    };

    // Add search query
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { nickname: { contains: query, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await db.contact.count({ where });

    // Get contacts
    const contacts = await db.contact.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { createdAt: "desc" },
      include: {
        gender: true,
        vault: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            notes: true,
            activities: true,
            reminders: true,
            tasks: true,
            gifts: true,
            calls: true,
          },
        },
      },
    });

    // Transform to API format
    const data = contacts.map((contact) => ({
      id: contact.id,
      object: "contact",
      first_name: contact.firstName,
      last_name: contact.lastName,
      nickname: contact.nickname,
      complete_name: [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(" "),
      gender: contact.gender?.name || null,
      is_partial: false,
      is_dead: false,
      vault: {
        id: contact.vault.id,
        name: contact.vault.name,
      },
      tags: contact.tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        slug: ct.tag.slug,
      })),
      statistics: {
        number_of_notes: contact._count.notes,
        number_of_activities: contact._count.activities,
        number_of_reminders: contact._count.reminders,
        number_of_tasks: contact._count.tasks,
        number_of_gifts: contact._count.gifts,
        number_of_calls: contact._count.calls,
      },
      created_at: contact.createdAt.toISOString(),
      updated_at: contact.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "contacts:read"
);

// POST /api/v1/contacts - Create a contact
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const {
        first_name,
        last_name,
        nickname,
        gender_id,
        vault_id,
      } = body;

      if (!first_name) {
        return apiError("INVALID_PARAMS", 400, "first_name is required");
      }

      // Verify user has access to the vault
      let vaultId = vault_id;

      if (!vaultId) {
        // Use first available vault
        const userVault = await db.userVault.findFirst({
          where: { userId: context.userId },
        });
        if (!userVault) {
          return apiError("NOT_FOUND", 404, "No vault found");
        }
        vaultId = userVault.vaultId;
      } else {
        // Verify access
        const hasAccess = await db.userVault.findFirst({
          where: {
            userId: context.userId,
            vaultId,
          },
        });
        if (!hasAccess) {
          return apiError("FORBIDDEN", 403);
        }
      }

      // Create contact
      const contact = await db.contact.create({
        data: {
          vaultId,
          firstName: first_name,
          lastName: last_name || null,
          nickname: nickname || null,
          genderId: gender_id || null,
        },
        include: {
          gender: true,
          vault: { select: { id: true, name: true } },
        },
      });

      return apiSuccess(
        {
          id: contact.id,
          object: "contact",
          first_name: contact.firstName,
          last_name: contact.lastName,
          nickname: contact.nickname,
          complete_name: [contact.firstName, contact.lastName]
            .filter(Boolean)
            .join(" "),
          gender: contact.gender?.name || null,
          vault: {
            id: contact.vault.id,
            name: contact.vault.name,
          },
          created_at: contact.createdAt.toISOString(),
          updated_at: contact.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "contacts:write"
);
