"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createImportantDate } from "@/lib/actions/important-dates";
import { Loader2, Plus, X, Calendar } from "lucide-react";

interface ImportantDateFormProps {
  contactId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function ImportantDateForm({
  contactId,
  onSuccess,
  onCancel,
}: ImportantDateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("contactId", contactId);

    startTransition(async () => {
      const result = await createImportantDate(formData);

      if (result.success) {
        setIsExpanded(false);
        onSuccess?.();
        const form = document.getElementById("date-form") as HTMLFormElement;
        form?.reset();
      } else {
        setError(result.error || "An error occurred");
      }
    });
  }

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-gray-500"
        onClick={() => setIsExpanded(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add important date...
      </Button>
    );
  }

  return (
    <form id="date-form" action={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium">Add Important Date</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateType">Type</Label>
        <select
          id="dateType"
          name="dateType"
          defaultValue="birthday"
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="birthday">Birthday</option>
          <option value="anniversary">Anniversary</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          name="label"
          placeholder="Birthday, Anniversary, etc."
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="day">Day</Label>
          <Input
            id="day"
            name="day"
            type="number"
            min="1"
            max="31"
            placeholder="DD"
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <select
            id="month"
            name="month"
            disabled={isPending}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Month</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="year">Year (optional)</Label>
          <Input
            id="year"
            name="year"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 10}
            placeholder="YYYY"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">Leave empty if unknown — the date recurs yearly, but age won't be shown.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(false);
            onCancel?.();
          }}
          disabled={isPending}
        >
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Date
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
