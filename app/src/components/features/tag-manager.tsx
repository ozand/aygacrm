"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag as TagIcon, Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { getTags, createTag, updateTag, deleteTag, Tag } from "@/lib/actions/tags";

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      setLoading(true);
      const data = await getTags();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const tag = await createTag(newTagName.trim());
      setTags([...tags, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const updated = await updateTag(id, editingName.trim());
      setTags(
        tags
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const tag = tags.find((t) => t.id === id);
    if (!tag) return;

    if (tag.contactsCount > 0) {
      if (
        !confirm(
          `This tag is assigned to ${tag.contactsCount} contact(s). Are you sure you want to delete it?`
        )
      ) {
        return;
      }
    }

    try {
      setDeletingId(id);
      setError(null);
      await deleteTag(id);
      setTags(tags.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setDeletingId(null);
    }
  }

  function startEditing(tag: Tag) {
    setEditingId(tag.id);
    setEditingName(tag.name);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingName("");
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TagIcon className="h-5 w-5" />
          Tags
        </CardTitle>
        <CardDescription>
          Create tags to organize and categorize your contacts. Tags can be assigned to multiple
          contacts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Create new tag form */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder="New tag name..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="flex-1"
            disabled={creating}
          />
          <Button type="submit" disabled={creating || !newTagName.trim()}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-2">Add Tag</span>
          </Button>
        </form>

        {/* Tags list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4 text-center">
            No tags created yet. Create your first tag above.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                {editingId === tag.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleUpdate(tag.id);
                        } else if (e.key === "Escape") {
                          cancelEditing();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUpdate(tag.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <TagIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{tag.name}</span>
                      {tag.contactsCount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({tag.contactsCount})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(tag)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(tag.id)}
                        disabled={deletingId === tag.id}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === tag.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
