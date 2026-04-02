"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS, type AuditAction, type AuditLogObjects } from "@/lib/api/audit-constants";

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
