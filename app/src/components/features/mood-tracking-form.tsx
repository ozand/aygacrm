"use client";

import { useState, useEffect, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getMoodTrackingParameters,
  getMoodEvents,
  createMoodEvent,
  updateMoodEvent,
  deleteMoodEvent,
} from "@/lib/actions/mood-tracking";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Moon, SmilePlus, Calendar } from "lucide-react";

interface MoodParameter {
  id: string;
  label: string;
  position: number;
}

interface MoodEvent {
  id: string;
  ratedAt: Date;
  note: string | null;
  numberOfHoursSlept: number | null;
  parameter: MoodParameter | null;
}

interface MoodTrackingFormProps {
  contactId: string;
}

export function MoodTrackingForm({ contactId }: MoodTrackingFormProps) {
  const [parameters, setParameters] = useState<MoodParameter[]>([]);
  const [events, setEvents] = useState<MoodEvent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [parameterId, setParameterId] = useState<string>("");
  const [ratedAt, setRatedAt] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");
  const [hoursSlept, setHoursSlept] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [contactId]);

  function loadData() {
    startTransition(async () => {
      const [params, moodEvents] = await Promise.all([
        getMoodTrackingParameters(),
        getMoodEvents(contactId),
      ]);
      setParameters(params);
      setEvents(moodEvents);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const data = {
        contactId,
        parameterId: parameterId || undefined,
        ratedAt: new Date(ratedAt),
        note: note || undefined,
        numberOfHoursSlept: hoursSlept ? parseInt(hoursSlept) : undefined,
      };

      if (editingId) {
        await updateMoodEvent(editingId, {
          parameterId: parameterId || null,
          ratedAt: new Date(ratedAt),
          note: note || null,
          numberOfHoursSlept: hoursSlept ? parseInt(hoursSlept) : null,
        });
      } else {
        await createMoodEvent(data);
      }
      loadData();
      resetForm();
    });
  }

  function handleEdit(event: MoodEvent) {
    setEditingId(event.id);
    setParameterId(event.parameter?.id || "");
    setRatedAt(new Date(event.ratedAt).toISOString().split("T")[0]);
    setNote(event.note || "");
    setHoursSlept(event.numberOfHoursSlept?.toString() || "");
    setIsOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this mood entry?")) return;

    startTransition(async () => {
      await deleteMoodEvent(id);
      loadData();
    });
  }

  function resetForm() {
    setEditingId(null);
    setParameterId("");
    setRatedAt(new Date().toISOString().split("T")[0]);
    setNote("");
    setHoursSlept("");
    setIsOpen(false);
  }

  // Get mood emoji based on position (lower = worse, higher = better)
  function getMoodEmoji(param: MoodParameter | null): string {
    if (!param) return "😐";
    const position = param.position;
    const total = parameters.length;
    const ratio = total > 1 ? position / (total - 1) : 0.5;
    
    if (ratio < 0.2) return "😢";
    if (ratio < 0.4) return "😕";
    if (ratio < 0.6) return "😐";
    if (ratio < 0.8) return "🙂";
    return "😊";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-medium">Mood Tracking</CardTitle>
          <CardDescription>Track how this person is feeling</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Log Mood
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit" : "Log"} Mood Entry
                </DialogTitle>
                <DialogDescription>
                  Record how this person is feeling today
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="mood">Mood Level</Label>
                  {parameters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No mood parameters configured.{" "}
                      <a href="/settings" className="text-primary underline">
                        Add them in settings
                      </a>
                    </p>
                  ) : (
                    <Select value={parameterId} onValueChange={setParameterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mood level" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameters.map((param) => (
                          <SelectItem key={param.id} value={param.id}>
                            {getMoodEmoji(param)} {param.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ratedAt">Date</Label>
                  <Input
                    id="ratedAt"
                    type="date"
                    value={ratedAt}
                    onChange={(e) => setRatedAt(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hoursSlept">Hours Slept (optional)</Label>
                  <Input
                    id="hoursSlept"
                    type="number"
                    min="0"
                    max="24"
                    value={hoursSlept}
                    onChange={(e) => setHoursSlept(e.target.value)}
                    placeholder="e.g., 8"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="note">Notes (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any additional context..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {editingId ? "Update" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <SmilePlus className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No mood entries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getMoodEmoji(event.parameter)}</span>
                  <div>
                    <div className="font-medium">
                      {event.parameter?.label || "Unspecified"}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(event.ratedAt), "MMM d, yyyy")}
                      {event.numberOfHoursSlept && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <Moon className="h-3 w-3" />
                          {event.numberOfHoursSlept}h sleep
                        </>
                      )}
                    </div>
                    {event.note && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(event)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(event.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {events.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                +{events.length - 5} more entries
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
