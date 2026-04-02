export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// GET /api/v1/contacts/:id
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const contactId = params?.id;
    if (!contactId) {
      return apiError("NOT_FOUND", 404);
    }

    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        vault: {
          users: {
            some: { userId: context.userId },
          },
        },
      },
      include: {
        gender: true,
        pronoun: true,
        vault: { select: { id: true, name: true } },
        addresses: {
          include: {
            addressType: true,
          },
        },
        contactInformation: {
          include: {
            type: true,
          },
        },
        importantDates: {
          include: {
            type: true,
          },
        },
        tags: {
          include: { tag: true },
        },
        relationships: {
          include: {
            relatedContact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
              },
            },
            relationshipType: {
              include: {
                groupType: true,
              },
            },
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
            loans: true,
          },
        },
      },
    });

    if (!contact) {
      return apiError("NOT_FOUND", 404);
    }

    // Group relationships by type
    const relationships: Record<string, { total: number; contacts: unknown[] }> = {};
    for (const rel of contact.relationships) {
      const groupName = rel.relationshipType?.groupType?.name || "other";
      if (!relationships[groupName]) {
        relationships[groupName] = { total: 0, contacts: [] };
      }
      relationships[groupName].total++;
      relationships[groupName].contacts.push({
        relationship: {
          id: rel.id,
          name: rel.relationshipType?.name,
        },
        contact: {
          id: rel.relatedContact.id,
          first_name: rel.relatedContact.firstName,
          last_name: rel.relatedContact.lastName,
          nickname: rel.relatedContact.nickname,
        },
      });
    }

    // Find birthdate
    const birthdate = contact.importantDates.find(
      (d) => d.type?.type === "birthday"
    );

    // Build date from components
    const birthdateValue = birthdate
      ? birthdate.year && birthdate.month && birthdate.day
        ? new Date(birthdate.year, birthdate.month - 1, birthdate.day).toISOString()
        : null
      : null;

    return apiSuccess({
      id: contact.id,
      object: "contact",
      first_name: contact.firstName,
      last_name: contact.lastName,
      nickname: contact.nickname,
      complete_name: [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(" "),
      initials: [contact.firstName?.[0], contact.lastName?.[0]]
        .filter(Boolean)
        .join("")
        .toUpperCase(),
      gender: contact.gender?.name || null,
      gender_type: contact.gender?.type || null,
      pronoun: contact.pronoun?.name || null,
      job_position: contact.jobPosition,
      is_partial: false,
      is_dead: false,
      vault: {
        id: contact.vault.id,
        name: contact.vault.name,
      },
      information: {
        relationships,
        dates: {
          birthdate: birthdateValue ? { date: birthdateValue } : null,
        },
      },
      addresses: contact.addresses.map((addr) => ({
        id: addr.id,
        object: "address",
        name: addr.addressType?.name || null,
        street: addr.line1,
        city: addr.city,
        province: addr.province,
        postal_code: addr.postalCode,
        country: addr.country,
      })),
      contact_fields: contact.contactInformation.map((ci) => ({
        id: ci.id,
        object: "contactfield",
        content: ci.data,
        contact_field_type: ci.type
          ? {
              id: ci.type.id,
              name: ci.type.name,
              type: ci.type.type,
              protocol: ci.type.protocol,
            }
          : null,
      })),
      tags: contact.tags.map((ct) => ({
        id: ct.tag.id,
        object: "tag",
        name: ct.tag.name,
        name_slug: ct.tag.slug,
      })),
      statistics: {
        number_of_notes: contact._count.notes,
        number_of_activities: contact._count.activities,
        number_of_reminders: contact._count.reminders,
        number_of_tasks: contact._count.tasks,
        number_of_gifts: contact._count.gifts,
        number_of_calls: contact._count.calls,
        number_of_debts: contact._count.loans,
      },
      created_at: contact.createdAt.toISOString(),
      updated_at: contact.updatedAt.toISOString(),
    });
  },
  "contacts:read"
);

// PUT /api/v1/contacts/:id
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const contactId = params?.id;
    if (!contactId) {
      return apiError("NOT_FOUND", 404);
    }

    // Check access
    const existing = await db.contact.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        vault: {
          users: {
            some: { userId: context.userId },
          },
        },
      },
    });

    if (!existing) {
      return apiError("NOT_FOUND", 404);
    }

    try {
      const body = await request.json();

      const {
        first_name,
        last_name,
        nickname,
        gender_id,
        pronoun_id,
        job_position,
      } = body;

      const contact = await db.contact.update({
        where: { id: contactId },
        data: {
          firstName: first_name !== undefined ? first_name : undefined,
          lastName: last_name !== undefined ? last_name : undefined,
          nickname: nickname !== undefined ? nickname : undefined,
          genderId: gender_id !== undefined ? gender_id : undefined,
          pronounId: pronoun_id !== undefined ? pronoun_id : undefined,
          jobPosition: job_position !== undefined ? job_position : undefined,
          lastUpdatedAt: new Date(),
        },
        include: {
          gender: true,
          vault: { select: { id: true, name: true } },
        },
      });

      return apiSuccess({
        id: contact.id,
        object: "contact",
        first_name: contact.firstName,
        last_name: contact.lastName,
        nickname: contact.nickname,
        complete_name: [contact.firstName, contact.lastName]
          .filter(Boolean)
          .join(" "),
        gender: contact.gender?.name || null,
        job_position: contact.jobPosition,
        vault: {
          id: contact.vault.id,
          name: contact.vault.name,
        },
        created_at: contact.createdAt.toISOString(),
        updated_at: contact.updatedAt.toISOString(),
      });
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "contacts:write"
);

// DELETE /api/v1/contacts/:id
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const contactId = params?.id;
    if (!contactId) {
      return apiError("NOT_FOUND", 404);
    }

    // Check access
    const existing = await db.contact.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        vault: {
          users: {
            some: { userId: context.userId },
          },
        },
      },
    });

    if (!existing) {
      return apiError("NOT_FOUND", 404);
    }

    if (!existing.canBeDeleted) {
      return apiError("FORBIDDEN", 403, "This contact cannot be deleted");
    }

    // Soft delete
    await db.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ deleted: true, id: contactId });
  },
  "contacts:delete"
);
