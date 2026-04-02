import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuditAction, AuditLogObjects } from "@/lib/api/audit-constants";

/**
 * Create an audit log entry for API requests.
 * This is called from API routes where we already have the auth context.
 * Does NOT throw — audit failures should never break the main operation.
 */
export async function createAuditLogFromApi(params: {
  action: AuditAction;
  objects: AuditLogObjects;
  userId: string;
  accountId: string;
  contactId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: params.action,
        objects: params.objects as Prisma.InputJsonValue,
        userId: params.userId,
        accountId: params.accountId,
        contactId: params.contactId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
