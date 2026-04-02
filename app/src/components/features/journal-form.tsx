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
import { Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { createJournal, updateJournal, deleteJournal } from "@/lib/actions/journal";

interface Journal {
  id: string;
  name: string;
  description: string | null;
  _count?: { posts: number };
}

interface JournalFormProps {
  journal?: Journal;
  onSuccess?: () => void;
}

export function JournalForm({ journal, onSuccess }: JournalFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(journal?.name || "");
  const [description, setDescription] = useState(journal?.description || "");

  const isEdit = !!journal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await updateJournal(journal.id, { name, description });
      } else {
        await createJournal({ name, description });
      }
      setOpen(false);
      setName("");
      setDescription("");
      onSuccess?.();
    } catch (error) {
      console.error("Error saving journal:", error);
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
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Journal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Journal" : "Create Journal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Journal"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this journal about?"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface JournalCardProps {
  journal: Journal;
  onDelete?: () => void;
}

export function JournalCard({ journal, onDelete }: JournalCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this journal and all its posts?")) return;
    setDeleting(true);
    try {
      await deleteJournal(journal.id);
      onDelete?.();
    } catch (error) {
      console.error("Error deleting journal:", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <a href={`/journal/${journal.id}`} className="flex-1 group">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            <h3 className="font-medium group-hover:text-primary">{journal.name}</h3>
          </div>
          {journal.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {journal.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {journal._count?.posts || 0} posts
          </p>
        </a>
        <div className="flex items-center gap-1">
          <JournalForm journal={journal} />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
