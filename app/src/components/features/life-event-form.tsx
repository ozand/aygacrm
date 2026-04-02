"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  Milestone,
  Calendar,
} from "lucide-react";
import { createLifeEvent, deleteLifeEvent } from "@/lib/actions/life-events";

interface LifeEventType {
  id: string;
  label: string;
}

interface LifeEventCategory {
  id: string;
  name: string;
  types: LifeEventType[];
}

interface LifeEventItem {
  id: string;
  summary: string | null;
  description: string | null;
  happenedAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  costs: any;
  currency: string | null;
  lifeEventType: {
    id: string;
    label: string;
    category: {
      id: string;
      name: string;
    };
  } | null;
}

interface LifeEventFormProps {
  contactId: string;
  categories: LifeEventCategory[];
  existingEvents: LifeEventItem[];
}

export function LifeEventForm({
  contactId,
  categories,
  existingEvents,
}: LifeEventFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [lifeEventTypeId, setLifeEventTypeId] = useState("");
  const [costs, setCosts] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!happenedAt) {
      setError("Date is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("happenedAt", happenedAt);
    if (summary) formData.set("summary", summary);
    if (description) formData.set("description", description);
    if (lifeEventTypeId) formData.set("lifeEventTypeId", lifeEventTypeId);
    if (costs) {
      formData.set("costs", costs);
      formData.set("currency", currency);
    }

    startTransition(async () => {
      const result = await createLifeEvent(formData);
      if (result.success) {
        setShowForm(false);
        resetForm();
      } else {
        setError(result.error || "Failed to add life event");
      }
    });
  };

  const resetForm = () => {
    setSummary("");
    setDescription("");
    setHappenedAt("");
    setLifeEventTypeId("");
    setCosts("");
    setCurrency("USD");
    setError(null);
  };

  const handleDelete = (eventId: string) => {
    startTransition(async () => {
      await deleteLifeEvent(eventId);
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCosts = (costs: number, currency: string | null) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(costs);
  };

  // Group events by year
  const eventsByYear = existingEvents.reduce(
    (acc, event) => {
      const year = new Date(event.happenedAt).getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(event);
      return acc;
    },
    {} as Record<number, LifeEventItem[]>
  );

  const years = Object.keys(eventsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Life events by year */}
      {years.length > 0 && (
        <div className="space-y-4">
          {years.map((year) => (
            <div key={year}>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {year}
              </h4>
              <div className="space-y-2">
                {eventsByYear[year].map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                      <Milestone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.summary ||
                            event.lifeEventType?.label ||
                            "Life Event"}
                        </span>
                        {event.lifeEventType && (
                          <Badge variant="secondary" className="text-xs">
                            {event.lifeEventType.category.name}
                          </Badge>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(event.happenedAt)}
                        </span>
                        {event.costs && (
                          <span>
                            {formatCosts(Number(event.costs), event.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(event.id)}
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

      {existingEvents.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No life events recorded. Track milestones and important moments.
        </p>
      )}

      {/* Add life event form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eventDate">Date *</Label>
              <Input
                id="eventDate"
                type="date"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventType">Type</Label>
              <Select value={lifeEventTypeId} onValueChange={setLifeEventTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <div key={category.id}>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500">
                        {category.name}
                      </div>
                      {category.types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventSummary">Summary</Label>
            <Input
              id="eventSummary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Got married, Started new job"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventDescription">Description</Label>
            <Textarea
              id="eventDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eventCosts">Costs (optional)</Label>
              <Input
                id="eventCosts"
                type="number"
                step="0.01"
                min="0"
                value={costs}
                onChange={(e) => setCosts(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventCurrency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="RUB">RUB</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Event
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
          Add Life Event
        </Button>
      )}
    </div>
  );
}
