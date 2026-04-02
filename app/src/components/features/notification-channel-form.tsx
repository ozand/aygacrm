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
import { Mail, MessageSquare, Plus, Loader2 } from "lucide-react";
import { createNotificationChannel } from "@/lib/actions/notification-channels";

export function NotificationChannelForm() {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("email");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("type", type);
    formData.set("label", label);
    formData.set("content", content);

    startTransition(async () => {
      const result = await createNotificationChannel(formData);
      if (result.success) {
        setShowForm(false);
        setLabel("");
        setContent("");
        setType("email");
      } else {
        setError(result.error || "Failed to create channel");
      }
    });
  };

  if (!showForm) {
    return (
      <Button
        variant="outline"
        onClick={() => setShowForm(true)}
        disabled={isPending}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Notification Channel
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="type">Channel Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
              </SelectItem>
              <SelectItem value="telegram">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Telegram
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            placeholder={type === "email" ? "Work Email" : "Personal Telegram"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">
            {type === "email" ? "Email Address" : "Telegram Chat ID"}
          </Label>
          <Input
            id="content"
            type={type === "email" ? "email" : "text"}
            placeholder={type === "email" ? "you@example.com" : "123456789"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Channel
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
  );
}
