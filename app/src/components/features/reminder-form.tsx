"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { createReminder, deleteReminder } from "@/lib/actions/reminders";

interface ImportantDate {
  id: string;
  label: string | null;
  day: number | null;
  month: number | null;
  year: number | null;
  type: {
    name: string;
  } | null;
}

interface Reminder {
  id: string;
  reminderChoice: string;
  numberOfDaysBefore: number;
  importantDate: ImportantDate;
}

interface ReminderFormProps {
  contactId: string;
  importantDates: ImportantDate[];
  existingReminders: Reminder[];
}

export function ReminderForm({
  contactId,
  importantDates,
  existingReminders,
}: ReminderFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState("");
  const [reminderChoice, setReminderChoice] = useState("day");
  const [customDays, setCustomDays] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDateId) {
      setError("Please select an important date");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("importantDateId", selectedDateId);
    formData.set("reminderChoice", reminderChoice);
    formData.set(
      "numberOfDaysBefore",
      reminderChoice === "custom" ? customDays : "0"
    );

    startTransition(async () => {
      const result = await createReminder(formData);
      if (result.success) {
        setShowForm(false);
        setSelectedDateId("");
        setReminderChoice("day");
        setCustomDays("1");
      } else {
        setError(result.error || "Failed to create reminder");
      }
    });
  };

  const handleDelete = (reminderId: string) => {
    startTransition(async () => {
      await deleteReminder(reminderId);
    });
  };

  const formatDate = (date: ImportantDate) => {
    const label = date.label || date.type?.name || "Important Date";
    if (date.month && date.day) {
      const d = new Date(2000, date.month - 1, date.day);
      const dateStr = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `${label} (${dateStr})`;
    }
    return label;
  };

  const getReminderDescription = (reminder: Reminder) => {
    switch (reminder.reminderChoice) {
      case "day":
        return "1 day before";
      case "week":
        return "1 week before";
      case "month":
        return "1 month before";
      default:
        return `${reminder.numberOfDaysBefore} days before`;
    }
  };

  if (importantDates.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        Add important dates first to set up reminders.
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing reminders */}
      {existingReminders.length > 0 && (
        <div className="space-y-2">
          {existingReminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {formatDate(reminder.importantDate)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getReminderDescription(reminder)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(reminder.id)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add reminder form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="importantDate">Important Date</Label>
            <Select value={selectedDateId} onValueChange={setSelectedDateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a date" />
              </SelectTrigger>
              <SelectContent>
                {importantDates.map((date) => (
                  <SelectItem key={date.id} value={date.id}>
                    {formatDate(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderChoice">Remind me</Label>
            <Select value={reminderChoice} onValueChange={setReminderChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">1 day before</SelectItem>
                <SelectItem value="week">1 week before</SelectItem>
                <SelectItem value="month">1 month before</SelectItem>
                <SelectItem value="custom">Custom days before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reminderChoice === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customDays">Days before</Label>
              <Input
                id="customDays"
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Reminder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
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
          Add Reminder
        </Button>
      )}
    </div>
  );
}
