"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Loader2,
  Activity,
  Calendar,
} from "lucide-react";
import { createActivity, deleteActivity } from "@/lib/actions/activities";

interface ActivityAuthor {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface ActivityItem {
  id: string;
  summary: string | null;
  description: string | null;
  happenedAt: Date | null;
  createdAt: Date;
  author?: ActivityAuthor | null;
}

interface ActivityFormProps {
  contactId: string;
  existingActivities: ActivityItem[];
}

export function ActivityForm({ contactId, existingActivities }: ActivityFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [happenedAt, setHappenedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!summary.trim()) {
      setError("Summary is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("summary", summary);
    if (description) formData.set("description", description);
    if (happenedAt) formData.set("happenedAt", happenedAt);

    startTransition(async () => {
      const result = await createActivity(formData);
      if (result.success) {
        setShowForm(false);
        resetForm();
      } else {
        setError(result.error || "Failed to add activity");
      }
    });
  };

  const resetForm = () => {
    setSummary("");
    setDescription("");
    setHappenedAt(new Date().toISOString().split("T")[0]);
    setError(null);
  };

  const handleDelete = (activityId: string) => {
    startTransition(async () => {
      await deleteActivity(activityId);
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Group activities by month/year
  const groupedActivities = existingActivities.reduce(
    (acc, activity) => {
      const date = activity.happenedAt || activity.createdAt;
      const key = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      if (!acc[key]) acc[key] = [];
      acc[key].push(activity);
      return acc;
    },
    {} as Record<string, ActivityItem[]>
  );

  const months = Object.keys(groupedActivities);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Activities by month */}
      {months.length > 0 && (
        <div className="space-y-4">
          {months.map((month) => (
            <div key={month}>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {month}
              </h4>
              <div className="space-y-2">
                {groupedActivities[month].map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.summary || "Activity"}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {activity.happenedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(activity.happenedAt)}
                          </span>
                        )}
                        {activity.author && (activity.author.firstName || activity.author.lastName) && (
                          <span>by {[activity.author.firstName, activity.author.lastName].filter(Boolean).join(" ")}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(activity.id)}
                      disabled={isPending}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {existingActivities.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No activities recorded. Log meetings, hangouts, and interactions.
        </p>
      )}

      {/* Add activity form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="activitySummary">Summary *</Label>
              <Input
                id="activitySummary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g., Had coffee, Watched movie"
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activityDate">Date</Label>
              <Input
                id="activityDate"
                type="date"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activityDescription">Details</Label>
            <Textarea
              id="activityDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you do together?"
              rows={2}
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Activity
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Activity
        </Button>
      )}
    </div>
  );
}
