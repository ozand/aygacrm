// Audit action constants and types — shared between server actions and API routes
// This file is NOT a "use server" module, so it can export plain objects

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
  
  // Call actions
  CALL_CREATED: "call_created",
  CALL_UPDATED: "call_updated",
  CALL_DELETED: "call_deleted",
  
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
