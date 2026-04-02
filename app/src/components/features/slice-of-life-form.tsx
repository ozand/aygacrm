"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import {
  createSliceOfLife,
  updateSliceOfLife,
  deleteSliceOfLife,
} from "@/lib/actions/journal";
import { format } from "date-fns";

interface SliceOfLife {
  id: string;
  name: string;
  description: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
}

interface SliceOfLifeFormProps {
  journalId: string;
  slice?: SliceOfLife;
  onSuccess?: () => void;
}

export function SliceOfLifeForm({
  journalId,
  slice,
  onSuccess,
}: SliceOfLifeFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(slice?.name || "");
  const [description, setDescription] = useState(slice?.description || "");
  const [startedAt, setStartedAt] = useState(
    slice?.startedAt ? format(new Date(slice.startedAt), "yyyy-MM-dd") : ""
  );
  const [endedAt, setEndedAt] = useState(
    slice?.endedAt ? format(new Date(slice.endedAt), "yyyy-MM-dd") : ""
  );

  const isEdit = !!slice;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await updateSliceOfLife(slice.id, {
          name,
          description: description || undefined,
          startedAt: startedAt ? new Date(startedAt) : null,
          endedAt: endedAt ? new Date(endedAt) : null,
        });
      } else {
        await createSliceOfLife({
          journalId,
          name,
          description: description || undefined,
          startedAt: startedAt ? new Date(startedAt) : undefined,
          endedAt: endedAt ? new Date(endedAt) : undefined,
        });
      }
      setOpen(false);
      if (!isEdit) {
        setName("");
        setDescription("");
        setStartedAt("");
        setEndedAt("");
      }
      onSuccess?.();
    } catch (error) {
      console.error("Error saving slice of life:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!slice || !confirm("Delete this slice of life?")) return;
    setLoading(true);
    try {
      await deleteSliceOfLife(slice.id);
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting slice of life:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Slice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Slice of Life" : "New Slice of Life"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer 2024, New Job, Moving to NYC"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this period special?"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Start Date</Label>
              <Input
                id="startedAt"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endedAt">End Date</Label>
              <Input
                id="endedAt"
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-between">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? "Saving..." : isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
