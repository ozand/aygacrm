"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

// Action types for audit logs
export const AUDIT_ACTIONS = {
  // Contact actions
  CONTACT_CREATED: "contact_created",
  CONTACT_UPDATED: "contact_updated",
  CONTACT_DELETED: "contact_deleted",
  CONTACT_ARCHIVED: "contact_archived",
  CONTACT_UNARCHIVED: "contact_unarchived",
  
  // Note actions
  NOTE_CREATED: "note_created",
  NOTE_UPDATED: "note_updated",
  NOTE_DELETED: "note_deleted",
  
  // Activity actions
  ACTIVITY_CREATED: "activity_created",
  ACTIVITY_UPDATED: "activity_updated",
  ACTIVITY_DELETED: "activity_deleted",
  
  // Reminder actions
  REMINDER_CREATED: "reminder_created",
  REMINDER_UPDATED: "reminder_updated",
  REMINDER_DELETED: "reminder_deleted",
  REMINDER_COMPLETED: "reminder_completed",
  
  // Task actions
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_DELETED: "task_deleted",
  TASK_COMPLETED: "task_completed",
  
  // Gift actions
  GIFT_CREATED: "gift_created",
  GIFT_UPDATED: "gift_updated",
  GIFT_DELETED: "gift_deleted",
  
  // Debt actions
  DEBT_CREATED: "debt_created",
  DEBT_UPDATED: "debt_updated",
  DEBT_DELETED: "debt_deleted",
  
  // Journal actions
  JOURNAL_ENTRY_CREATED: "journal_entry_created",
  JOURNAL_ENTRY_UPDATED: "journal_entry_updated",
  JOURNAL_ENTRY_DELETED: "journal_entry_deleted",
  
  // Tag actions
  TAG_CREATED: "tag_created",
  TAG_UPDATED: "tag_updated",
  TAG_DELETED: "tag_deleted",
  TAG_ASSIGNED: "tag_assigned",
  TAG_REMOVED: "tag_removed",
  
  // Relationship actions
  RELATIONSHIP_CREATED: "relationship_created",
  RELATIONSHIP_DELETED: "relationship_deleted",
  
  // API Token actions
  API_TOKEN_CREATED: "api_token_created",
  API_TOKEN_REVOKED: "api_token_revoked",
  
  // Account actions
  ACCOUNT_UPDATED: "account_updated",
  USER_UPDATED: "user_updated",
  PASSWORD_CHANGED: "password_changed",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export interface AuditLogObjects {
  // The ID and name/summary of the primary entity
  entityId?: string | number;
  entityName?: string;
  entityType?: string;
  
  // Additional related entities
  relatedEntities?: Array<{
    id: string | number;
    type: string;
    name?: string;
  }>;
  
  // Field-level changes (for updates)
  changes?: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  
  // Additional context
  [key: string]: unknown;
}

interface CreateAuditLogParams {
  action: AuditAction;
  objects: AuditLogObjects;
  contactId?: string;
}

// Get user's vault and account for server actions
async function getUserVaultAndAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) throw new Error("No vault found");
  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

/**
 * Create an audit log entry
 * This should be called after successful operations to track user actions
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const { userId, accountId } = await getUserVaultAndAccount();
    const headersList = await headers();
    
    // Extract IP and user agent from headers
    const ipAddress = 
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      null;
    const userAgent = headersList.get("user-agent") || null;

    await db.auditLog.create({
      data: {
        action: params.action,
        objects: params.objects as Prisma.InputJsonValue,
        userId,
        accountId,
        contactId: params.contactId || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit log failures shouldn't break the main operation
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Create an audit log entry for API requests
 * This is called from API routes where we already have the context
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

/**
 * Get audit logs for an account with pagination
 */
export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  contactId?: string;
  action?: AuditAction;
}) {
  const { accountId } = await getUserVaultAndAccount();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const where: Record<string, unknown> = {
    accountId,
  };

  if (options?.contactId) {
    where.contactId = options.contactId;
  }

  if (options?.action) {
    where.action = options.action;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      objects: log.objects as AuditLogObjects,
      user: log.user
        ? {
            id: log.user.id,
            name: [log.user.firstName, log.user.lastName]
              .filter(Boolean)
              .join(" ") || log.user.email,
          }
        : null,
      contact: log.contact
        ? {
            id: log.contact.id,
            name: [log.contact.firstName, log.contact.lastName]
              .filter(Boolean)
              .join(" "),
          }
        : null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Get a human-readable description of an audit action
 */
export async function getAuditActionDescription(action: AuditAction, objects: AuditLogObjects): Promise<string> {
  const entityName = objects.entityName || "item";
  
  switch (action) {
    case AUDIT_ACTIONS.CONTACT_CREATED:
      return `Created contact "${entityName}"`;
    case AUDIT_ACTIONS.CONTACT_UPDATED:
      return `Updated contact "${entityName}"`;
    case AUDIT_ACTIONS.CONTACT_DELETED:
      return `Deleted contact "${entityName}"`;
    case AUDIT_ACTIONS.CONTACT_ARCHIVED:
      return `Archived contact "${entityName}"`;
    case AUDIT_ACTIONS.CONTACT_UNARCHIVED:
      return `Unarchived contact "${entityName}"`;
    
    case AUDIT_ACTIONS.NOTE_CREATED:
      return `Added note to contact`;
    case AUDIT_ACTIONS.NOTE_UPDATED:
      return `Updated note`;
    case AUDIT_ACTIONS.NOTE_DELETED:
      return `Deleted note`;
    
    case AUDIT_ACTIONS.ACTIVITY_CREATED:
      return `Logged activity "${entityName}"`;
    case AUDIT_ACTIONS.ACTIVITY_UPDATED:
      return `Updated activity "${entityName}"`;
    case AUDIT_ACTIONS.ACTIVITY_DELETED:
      return `Deleted activity`;
    
    case AUDIT_ACTIONS.REMINDER_CREATED:
      return `Created reminder "${entityName}"`;
    case AUDIT_ACTIONS.REMINDER_COMPLETED:
      return `Completed reminder "${entityName}"`;
    case AUDIT_ACTIONS.REMINDER_DELETED:
      return `Deleted reminder`;
    
    case AUDIT_ACTIONS.TASK_CREATED:
      return `Created task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_COMPLETED:
      return `Completed task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_DELETED:
      return `Deleted task`;
    
    case AUDIT_ACTIONS.GIFT_CREATED:
      return `Added gift "${entityName}"`;
    case AUDIT_ACTIONS.GIFT_UPDATED:
      return `Updated gift "${entityName}"`;
    case AUDIT_ACTIONS.GIFT_DELETED:
      return `Deleted gift`;
    
    case AUDIT_ACTIONS.DEBT_CREATED:
      return `Added debt`;
    case AUDIT_ACTIONS.DEBT_UPDATED:
      return `Updated debt`;
    case AUDIT_ACTIONS.DEBT_DELETED:
      return `Deleted debt`;
    
    case AUDIT_ACTIONS.TAG_ASSIGNED:
      return `Assigned tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_REMOVED:
      return `Removed tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_CREATED:
      return `Created tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_DELETED:
      return `Deleted tag "${entityName}"`;
    
    case AUDIT_ACTIONS.RELATIONSHIP_CREATED:
      return `Added relationship`;
    case AUDIT_ACTIONS.RELATIONSHIP_DELETED:
      return `Removed relationship`;
    
    case AUDIT_ACTIONS.API_TOKEN_CREATED:
      return `Created API token "${entityName}"`;
    case AUDIT_ACTIONS.API_TOKEN_REVOKED:
      return `Revoked API token "${entityName}"`;
    
    case AUDIT_ACTIONS.PASSWORD_CHANGED:
      return `Changed password`;
    case AUDIT_ACTIONS.USER_UPDATED:
      return `Updated profile`;
    case AUDIT_ACTIONS.ACCOUNT_UPDATED:
      return `Updated account settings`;
    
    default:
      return `${action}`;
  }
}
