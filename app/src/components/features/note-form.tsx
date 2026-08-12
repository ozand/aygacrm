"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNote } from "@/lib/actions/notes";
import { Loader2, Plus, X, Smile, Meh, Frown } from "lucide-react";

interface Emotion {
  id: string;
  name: string;
  type: string;
}

interface NoteFormProps {
  contactId: string;
  emotions?: Emotion[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NoteForm({ contactId, emotions = [], onSuccess, onCancel }: NoteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [emotionId, setEmotionId] = useState("");

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("contactId", contactId);
    if (emotionId && emotionId !== "none") {
      formData.set("emotionId", emotionId);
    }

    startTransition(async () => {
      const result = await createNote(formData);

      if (result.success) {
        setIsExpanded(false);
        setEmotionId("");
        onSuccess?.();
        // Reset form
        const form = document.getElementById("note-form") as HTMLFormElement;
        form?.reset();
      } else {
        setError(result.error || "An error occurred");
      }
    });
  }

  const getEmotionIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "negative":
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start text-gray-500"
        onClick={() => setIsExpanded(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add a note...
      </Button>
    );
  }

  return (
    <form id="note-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          name="title"
          placeholder="Note title"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Note</Label>
        <textarea
          id="body"
          name="body"
          placeholder="Write your note here..."
          rows={4}
          disabled={isPending}
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
      </div>

      {emotions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="emotion">How are you feeling? (optional)</Label>
          <Select value={emotionId} onValueChange={setEmotionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select mood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No mood</SelectItem>
              {emotions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="flex items-center gap-2">
                    {getEmotionIcon(e.type)}
                    {e.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
            setEmotionId("");
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
              Add Note
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
