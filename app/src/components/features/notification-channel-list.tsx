"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageSquare,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  toggleNotificationChannel,
  deleteNotificationChannel,
  sendTestNotification,
} from "@/lib/actions/notification-channels";

interface NotificationChannel {
  id: string;
  type: string;
  label: string;
  content: string;
  active: boolean;
  verified: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
}

interface NotificationChannelListProps {
  channels: NotificationChannel[];
}

export function NotificationChannelList({ channels }: NotificationChannelListProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (channelId: string) => {
    startTransition(async () => {
      await toggleNotificationChannel(channelId);
    });
  };

  const handleDelete = (channelId: string) => {
    if (!confirm("Are you sure you want to delete this notification channel?")) {
      return;
    }
    startTransition(async () => {
      await deleteNotificationChannel(channelId);
    });
  };

  const handleTest = (channelId: string) => {
    startTransition(async () => {
      const result = await sendTestNotification(channelId);
      if (result.success) {
        alert("Test notification sent!");
      } else {
        alert("Failed to send test notification: " + result.error);
      }
    });
  };

  if (channels.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        No notification channels set up yet. Add one above to receive reminders.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${isPending ? "opacity-50" : ""}`}>
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-center justify-between p-4 rounded-lg border bg-white dark:bg-gray-900"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {channel.type === "email" ? (
                <Mail className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{channel.label}</p>
                {channel.verified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {channel.content}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {channel.active ? "Active" : "Paused"}
              </span>
              <Switch
                checked={channel.active}
                onCheckedChange={() => handleToggle(channel.id)}
                disabled={isPending}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleTest(channel.id)}
              disabled={isPending || !channel.active}
              title="Send test notification"
            >
              <Send className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(channel.id)}
              disabled={isPending}
              title="Delete channel"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
