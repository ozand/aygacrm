"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Plus,
  Trash2,
  Loader2,
  Clock,
} from "lucide-react";
import { createCall, deleteCall } from "@/lib/actions/calls";

interface CallReason {
  id: string;
  label: string;
}

interface CallReasonType {
  id: string;
  label: string;
  reasons: CallReason[];
}

interface Call {
  id: string;
  calledAt: Date;
  duration: number | null;
  description: string | null;
  callReason: CallReason | null;
}

interface CallFormProps {
  contactId: string;
  callReasonTypes: CallReasonType[];
  existingCalls: Call[];
}

export function CallForm({
  contactId,
  callReasonTypes,
  existingCalls,
}: CallFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [calledAt, setCalledAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [callReasonId, setCallReasonId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("calledAt", calledAt);
    if (duration) formData.set("duration", duration);
    if (description) formData.set("description", description);
    if (callReasonId) formData.set("callReasonId", callReasonId);

    startTransition(async () => {
      const result = await createCall(formData);
      if (result.success) {
        setShowForm(false);
        setCalledAt(new Date().toISOString().slice(0, 16));
        setDuration("");
        setDescription("");
        setCallReasonId("");
      } else {
        setError(result.error || "Failed to log call");
      }
    });
  };

  const handleDelete = (callId: string) => {
    startTransition(async () => {
      await deleteCall(callId);
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing calls */}
      {existingCalls.length > 0 ? (
        <div className="space-y-2">
          {existingCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <Phone className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Call</p>
                  {call.duration && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.duration)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(call.calledAt)}
                </p>
                {call.callReason && (
                  <p className="text-xs text-primary mt-1">
                    {call.callReason.label}
                  </p>
                )}
                {call.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {call.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(call.id)}
                disabled={isPending}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No calls logged yet.
          </p>
        )
      )}

      {/* Add call form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="calledAt">Date & Time *</Label>
              <Input
                id="calledAt"
                type="datetime-local"
                value={calledAt}
                onChange={(e) => setCalledAt(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 300 for 5 min"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="callReason">Reason</Label>
              <Select value={callReasonId} onValueChange={setCallReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {callReasonTypes.length === 0 ? (
                    <SelectItem value="" disabled>
                      No reasons available
                    </SelectItem>
                  ) : (
                    callReasonTypes.map((type) => (
                      <SelectGroup key={type.id}>
                        <SelectLabel>{type.label}</SelectLabel>
                        {type.reasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you talk about?"
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Call
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setError(null);
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
          Log Call
        </Button>
      )}
    </div>
  );
}
