"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Contact,
  FileText,
  Calendar,
  Gift,
  Phone,
  CheckSquare,
  Bell,
  Tag,
  Key,
  Settings,
} from "lucide-react";
import {
  getAuditLogs,
  AUDIT_ACTIONS,
  AuditAction,
  AuditLogObjects,
} from "@/lib/actions/audit";
import { formatDistanceToNow } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  objects: AuditLogObjects;
  user: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  ipAddress: string | null;
  createdAt: Date;
}

// Get icon for action type
function getActionIcon(action: string) {
  if (action.startsWith("contact_")) return <Contact className="h-4 w-4" />;
  if (action.startsWith("note_")) return <FileText className="h-4 w-4" />;
  if (action.startsWith("activity_")) return <Calendar className="h-4 w-4" />;
  if (action.startsWith("gift_")) return <Gift className="h-4 w-4" />;
  if (action.startsWith("call_")) return <Phone className="h-4 w-4" />;
  if (action.startsWith("task_")) return <CheckSquare className="h-4 w-4" />;
  if (action.startsWith("reminder_")) return <Bell className="h-4 w-4" />;
  if (action.startsWith("tag_")) return <Tag className="h-4 w-4" />;
  if (action.startsWith("api_token_")) return <Key className="h-4 w-4" />;
  if (action.startsWith("account_") || action.startsWith("user_") || action === "password_changed")
    return <Settings className="h-4 w-4" />;
  return <History className="h-4 w-4" />;
}

// Get action category color
function getActionColor(action: string) {
  if (action.includes("created")) return "text-green-600 bg-green-50 dark:bg-green-900/20";
  if (action.includes("deleted") || action.includes("revoked"))
    return "text-red-600 bg-red-50 dark:bg-red-900/20";
  if (action.includes("updated") || action.includes("changed"))
    return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
  if (action.includes("completed")) return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
  return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
}

// Action filter options
const ACTION_FILTERS = [
  { value: "all", label: "All Actions" },
  { value: "contact", label: "Contact Actions" },
  { value: "note", label: "Note Actions" },
  { value: "activity", label: "Activity Actions" },
  { value: "task", label: "Task Actions" },
  { value: "reminder", label: "Reminder Actions" },
  { value: "gift", label: "Gift Actions" },
  { value: "tag", label: "Tag Actions" },
  { value: "api", label: "API Token Actions" },
  { value: "account", label: "Account Actions" },
];

function getAuditActionDescription(action: AuditAction, objects: AuditLogObjects): string {
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
      return "Added note to contact";
    case AUDIT_ACTIONS.NOTE_UPDATED:
      return "Updated note";
    case AUDIT_ACTIONS.NOTE_DELETED:
      return "Deleted note";
    case AUDIT_ACTIONS.ACTIVITY_CREATED:
      return `Logged activity "${entityName}"`;
    case AUDIT_ACTIONS.ACTIVITY_UPDATED:
      return `Updated activity "${entityName}"`;
    case AUDIT_ACTIONS.ACTIVITY_DELETED:
      return "Deleted activity";
    case AUDIT_ACTIONS.REMINDER_CREATED:
      return `Created reminder "${entityName}"`;
    case AUDIT_ACTIONS.REMINDER_COMPLETED:
      return `Completed reminder "${entityName}"`;
    case AUDIT_ACTIONS.REMINDER_DELETED:
      return "Deleted reminder";
    case AUDIT_ACTIONS.TASK_CREATED:
      return `Created task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_COMPLETED:
      return `Completed task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_DELETED:
      return "Deleted task";
    case AUDIT_ACTIONS.GIFT_CREATED:
      return `Added gift "${entityName}"`;
    case AUDIT_ACTIONS.GIFT_UPDATED:
      return `Updated gift "${entityName}"`;
    case AUDIT_ACTIONS.GIFT_DELETED:
      return "Deleted gift";
    case AUDIT_ACTIONS.DEBT_CREATED:
      return "Added debt";
    case AUDIT_ACTIONS.DEBT_UPDATED:
      return "Updated debt";
    case AUDIT_ACTIONS.DEBT_DELETED:
      return "Deleted debt";
    case AUDIT_ACTIONS.TAG_ASSIGNED:
      return `Assigned tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_REMOVED:
      return `Removed tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_CREATED:
      return `Created tag "${entityName}"`;
    case AUDIT_ACTIONS.TAG_DELETED:
      return `Deleted tag "${entityName}"`;
    case AUDIT_ACTIONS.RELATIONSHIP_CREATED:
      return "Added relationship";
    case AUDIT_ACTIONS.RELATIONSHIP_DELETED:
      return "Removed relationship";
    case AUDIT_ACTIONS.API_TOKEN_CREATED:
      return `Created API token "${entityName}"`;
    case AUDIT_ACTIONS.API_TOKEN_REVOKED:
      return `Revoked API token "${entityName}"`;
    case AUDIT_ACTIONS.PASSWORD_CHANGED:
      return "Changed password";
    case AUDIT_ACTIONS.USER_UPDATED:
      return "Updated profile";
    case AUDIT_ACTIONS.ACCOUNT_UPDATED:
      return "Updated account settings";
    default:
      return `${action}`;
  }
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    loadLogs();
  }, [offset, filter]);

  async function loadLogs() {
    try {
      setLoading(true);
      setError(null);

      // Convert filter to action prefix
      let actionFilter: AuditAction | undefined;
      if (filter !== "all") {
        // Find first matching action for the category
        const prefix = filter + "_";
        const matchingAction = Object.values(AUDIT_ACTIONS).find((a) =>
          a.startsWith(prefix)
        );
        if (matchingAction) {
          // We'll filter client-side for category
        }
      }

      const result = await getAuditLogs({
        limit,
        offset,
        action: actionFilter,
      });

      // Client-side filter by category if needed
      let filteredLogs = result.logs;
      if (filter !== "all") {
        const prefix = filter === "api" ? "api_token_" : filter === "account" ? "account_" : filter + "_";
        filteredLogs = result.logs.filter(
          (log) =>
            log.action.startsWith(prefix) ||
            (filter === "account" &&
              (log.action === "user_updated" || log.action === "password_changed"))
        );
      }

      setLogs(filteredLogs);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          View a history of actions performed in your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center justify-between">
          <Select value={filter} onValueChange={(v) => { setFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pagination info */}
          {!loading && total > 0 && (
            <span className="text-sm text-gray-500">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Logs list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-8 text-center">
            No activity logs found.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                {/* Action icon */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${getActionColor(
                    log.action
                  )}`}
                >
                  {getActionIcon(log.action)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getAuditActionDescription(log.action as AuditAction, log.objects)}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {log.user && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.user.name}
                      </span>
                    )}
                    {log.contact && (
                      <span className="flex items-center gap-1">
                        <Contact className="h-3 w-3" />
                        {log.contact.name}
                      </span>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* IP address (optional) */}
                {log.ipAddress && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {log.ipAddress}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
