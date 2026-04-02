"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  getMoodTrackingParameters,
  createMoodTrackingParameter,
  updateMoodTrackingParameter,
  deleteMoodTrackingParameter,
  seedDefaultMoodParameters,
} from "@/lib/actions/mood-tracking";
import { Plus, Edit, Trash2, GripVertical, SmilePlus } from "lucide-react";

interface MoodParameter {
  id: string;
  label: string;
  position: number;
}

export function MoodTrackingManager() {
  const [parameters, setParameters] = useState<MoodParameter[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    loadParameters();
  }, []);

  function loadParameters() {
    startTransition(async () => {
      const data = await getMoodTrackingParameters();
      setParameters(data);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      if (editingId) {
        await updateMoodTrackingParameter(editingId, { label });
      } else {
        await createMoodTrackingParameter({ label });
      }
      loadParameters();
      resetForm();
    });
  }

  function handleEdit(param: MoodParameter) {
    setEditingId(param.id);
    setLabel(param.label);
    setIsOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this mood parameter?")) return;

    startTransition(async () => {
      await deleteMoodTrackingParameter(id);
      loadParameters();
    });
  }

  function handleSeedDefaults() {
    startTransition(async () => {
      await seedDefaultMoodParameters();
      loadParameters();
    });
  }

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setIsOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Mood Tracking Parameters</h3>
          <p className="text-sm text-muted-foreground">
            Configure the mood levels that can be tracked for contacts
          </p>
        </div>
        <div className="flex gap-2">
          {parameters.length === 0 && (
            <Button
              variant="outline"
              onClick={handleSeedDefaults}
              disabled={isPending}
            >
              <SmilePlus className="mr-2 h-4 w-4" />
              Add Defaults
            </Button>
          )}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Parameter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit" : "Add"} Mood Parameter
                  </DialogTitle>
                  <DialogDescription>
                    Define a mood level like &quot;Happy&quot;, &quot;Sad&quot;, &quot;Neutral&quot;, etc.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g., Happy, Sad, Neutral"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingId ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {parameters.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <SmilePlus className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No mood parameters defined yet.</p>
          <p className="text-sm">
            Click &quot;Add Defaults&quot; to get started with common mood levels.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {parameters.map((param) => (
            <div
              key={param.id}
              className="flex items-center justify-between p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <span className="font-medium">{param.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(param)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(param.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
