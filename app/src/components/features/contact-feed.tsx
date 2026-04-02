"use client";

import { useState, useEffect, useTransition } from "react";
import { getContactFeed, type FeedAction } from "@/lib/actions/feed";
import { getExternalRecordsForContact } from "@/lib/actions/external-records";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Phone,
  Gift,
  Target,
  Calendar,
  Heart,
  Users,
  Tag,
  Smile,
  Upload,
  MapPin,
  Clock,
  ChevronDown,
  Activity,
  CheckCircle,
  Bell,
  Globe,
  MessageSquare,
  ExternalLink,
} from "lucide-react";

interface FeedItem {
  id: string;
  action: string;
  feedableType: string;
  feedableId: string;
  createdAt: Date;
  authorId: string | null;
  relatedData: Record<string, unknown> | null;
}

interface UnifiedTimelineItem {
  id: string;
  type: "feed" | "external_record";
  timestamp: Date;
  feedItem?: FeedItem;
  externalRecord?: {
    id: string;
    source: string;
    kind: string;
    title: string | null;
    content: string | null;
    url: string | null;
    happenedAt: Date | null;
    createdAt: Date;
  };
}

interface ContactFeedProps {
  contactId: string;
  limit?: number;
}

// Map actions to icons and colors
const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  contact_created: { icon: Users, color: "text-green-500", label: "Contact created" },
  contact_updated: { icon: Users, color: "text-blue-500", label: "Contact updated" },
  note_added: { icon: FileText, color: "text-purple-500", label: "Note added" },
  note_updated: { icon: FileText, color: "text-purple-400", label: "Note updated" },
  note_deleted: { icon: FileText, color: "text-red-400", label: "Note deleted" },
  activity_logged: { icon: Activity, color: "text-blue-500", label: "Activity logged" },
  task_created: { icon: CheckCircle, color: "text-yellow-500", label: "Task created" },
  task_completed: { icon: CheckCircle, color: "text-green-500", label: "Task completed" },
  reminder_set: { icon: Bell, color: "text-orange-500", label: "Reminder set" },
  call_logged: { icon: Phone, color: "text-cyan-500", label: "Call logged" },
  gift_added: { icon: Gift, color: "text-pink-500", label: "Gift added" },
  gift_given: { icon: Gift, color: "text-pink-600", label: "Gift given" },
  loan_created: { icon: Gift, color: "text-amber-500", label: "Loan created" },
  loan_settled: { icon: Gift, color: "text-green-500", label: "Loan settled" },
  goal_created: { icon: Target, color: "text-indigo-500", label: "Goal created" },
  goal_achieved: { icon: Target, color: "text-green-500", label: "Goal achieved" },
  life_event_added: { icon: Calendar, color: "text-rose-500", label: "Life event added" },
  relationship_added: { icon: Heart, color: "text-red-500", label: "Relationship added" },
  relationship_removed: { icon: Heart, color: "text-gray-400", label: "Relationship removed" },
  label_added: { icon: Tag, color: "text-teal-500", label: "Label added" },
  label_removed: { icon: Tag, color: "text-gray-400", label: "Label removed" },
  group_joined: { icon: Users, color: "text-blue-500", label: "Joined group" },
  group_left: { icon: Users, color: "text-gray-400", label: "Left group" },
  mood_logged: { icon: Smile, color: "text-yellow-500", label: "Mood logged" },
  file_uploaded: { icon: Upload, color: "text-gray-500", label: "File uploaded" },
  address_added: { icon: MapPin, color: "text-emerald-500", label: "Address added" },
  important_date_added: { icon: Calendar, color: "text-violet-500", label: "Important date added" },
};

const sourceIcons: Record<string, React.ElementType> = {
  email: MessageSquare,
  telegram: MessageSquare,
  linkedin: Globe,
  todoist: CheckCircle,
  notion: FileText,
  zoom: Phone,
  phone: Phone,
  whatsapp: MessageSquare,
};

function getActionConfig(action: string) {
  return actionConfig[action] || { 
    icon: Clock, 
    color: "text-gray-500", 
    label: action.replace(/_/g, " ") 
  };
}

function getRecordIcon(source: string): React.ElementType {
  return sourceIcons[source] || Globe;
}

function getRelatedDataSummary(item: FeedItem): string | null {
  if (!item.relatedData) return null;

  switch (item.feedableType) {
    case "Note":
      return (item.relatedData.title as string) || 
             ((item.relatedData.body as string)?.substring(0, 50) + "...");
    case "Activity":
      return item.relatedData.summary as string;
    case "ContactTask":
      return item.relatedData.label as string;
    case "Call":
      return `${item.relatedData.type} call`;
    case "Gift":
      return `${item.relatedData.name} (${item.relatedData.status})`;
    case "Goal":
      return item.relatedData.name as string;
    case "LifeEvent":
      return item.relatedData.summary as string;
    case "MoodTrackingEvent":
      const mood = item.relatedData as { parameter?: { label: string }; note?: string };
      return mood.parameter?.label || mood.note || "Mood tracked";
    default:
      return null;
  }
}

export function ContactFeed({ contactId, limit = 10 }: ContactFeedProps) {
  const [timelineItems, setTimelineItems] = useState<UnifiedTimelineItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadFeed();
  }, [contactId, showAll]);

  function loadFeed() {
    startTransition(async () => {
      const displayLimit = showAll ? 100 : limit;

      // Fetch both feed items and external records in parallel
      const [feedItems, externalRecords] = await Promise.all([
        getContactFeed(contactId, { limit: displayLimit }),
        getExternalRecordsForContact(contactId),
      ]);

      // Merge into unified timeline
      const unified: UnifiedTimelineItem[] = [
        ...feedItems.map((item) => ({
          id: `feed-${item.id}`,
          type: "feed" as const,
          timestamp: new Date(item.createdAt),
          feedItem: item,
        })),
        ...externalRecords.map((record) => ({
          id: `record-${record.id}`,
          type: "external_record" as const,
          timestamp: record.happenedAt ? new Date(record.happenedAt) : new Date(record.createdAt),
          externalRecord: record,
        })),
      ];

      // Sort by timestamp desc
      unified.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const sliced = unified.slice(0, displayLimit);
      setTimelineItems(sliced);
      setTotalCount(unified.length);
    });
  }

  if (timelineItems.length === 0 && !isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
          <CardDescription>Recent activity and external records for this contact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group timeline items by date
  const groupedByDate = timelineItems.reduce((groups, item) => {
    const date = format(item.timestamp, "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, UnifiedTimelineItem[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
        <CardDescription>Recent activity and external records for this contact</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {Object.entries(groupedByDate).map(([date, items]) => (
              <div key={date}>
                {/* Date header */}
                <div className="relative flex items-center mb-3">
                  <div className="absolute left-0 w-8 h-8 bg-background flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  </div>
                  <div className="ml-12 text-sm font-medium text-muted-foreground">
                    {format(new Date(date), "EEEE, MMMM d, yyyy")}
                  </div>
                </div>

                {/* Items for this date */}
                <div className="space-y-2 ml-12">
                  {items.map((item) => {
                    if (item.type === "external_record" && item.externalRecord) {
                      const record = item.externalRecord;
                      const RecordIcon = getRecordIcon(record.source);

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="mt-0.5 text-indigo-500">
                            <RecordIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">
                                {record.title || `${record.source}/${record.kind}`}
                              </p>
                              {record.url && (
                                <a
                                  href={record.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {record.source} {record.kind}
                              {record.content && ` \u2014 ${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}`}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      );
                    }

                    // Regular feed item
                    if (item.feedItem) {
                      const config = getActionConfig(item.feedItem.action);
                      const Icon = config.icon;
                      const summary = getRelatedDataSummary(item.feedItem);

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className={`mt-0.5 ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{config.label}</p>
                            {summary && (
                              <p className="text-xs text-muted-foreground truncate">
                                {summary}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Show more button */}
        {!showAll && totalCount > limit && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              disabled={isPending}
            >
              <ChevronDown className="mr-2 h-4 w-4" />
              Show more activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
