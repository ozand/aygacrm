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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, FileText, Calendar } from "lucide-react";
import { createPost, updatePost, deletePost } from "@/lib/actions/journal";
import { formatDistanceToNow, format } from "date-fns";

interface SliceOfLife {
  id: string;
  name: string;
}

interface Post {
  id: number;
  title: string | null;
  content: string | null;
  writtenAt: Date;
  sliceOfLifeId: string | null;
  sliceOfLife?: SliceOfLife | null;
}

interface PostFormProps {
  journalId: string;
  post?: Post;
  slices?: SliceOfLife[];
  onSuccess?: () => void;
}

export function PostForm({ journalId, post, slices = [], onSuccess }: PostFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [writtenAt, setWrittenAt] = useState(
    post?.writtenAt
      ? format(new Date(post.writtenAt), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [sliceOfLifeId, setSliceOfLifeId] = useState(post?.sliceOfLifeId || "");

  const isEdit = !!post;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await updatePost(post.id, {
          title: title || undefined,
          content: content || undefined,
          writtenAt: new Date(writtenAt),
          sliceOfLifeId: sliceOfLifeId || null,
        });
      } else {
        await createPost({
          journalId,
          title: title || undefined,
          content: content || undefined,
          writtenAt: new Date(writtenAt),
          sliceOfLifeId: sliceOfLifeId || undefined,
        });
      }
      setOpen(false);
      if (!isEdit) {
        setTitle("");
        setContent("");
        setWrittenAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setSliceOfLifeId("");
      }
      onSuccess?.();
    } catch (error) {
      console.error("Error saving post:", error);
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
            New Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Post" : "Create Post"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a title..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="writtenAt">Date & Time</Label>
              <Input
                id="writtenAt"
                type="datetime-local"
                value={writtenAt}
                onChange={(e) => setWrittenAt(e.target.value)}
              />
            </div>
            
            {slices.length > 0 && (
              <div className="space-y-2">
                <Label>Slice of Life</Label>
                <Select value={sliceOfLifeId} onValueChange={setSliceOfLifeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {slices.map((slice) => (
                      <SelectItem key={slice.id} value={slice.id}>
                        {slice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thoughts..."
              rows={10}
              className="resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function PostCard({ post, onDelete, onEdit }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      onDelete?.();
    } catch (error) {
      console.error("Error deleting post:", error);
    } finally {
      setDeleting(false);
    }
  }

  const writtenDate = new Date(post.writtenAt);

  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span>{format(writtenDate, "PPP 'at' p")}</span>
            <span className="text-xs">
              ({formatDistanceToNow(writtenDate, { addSuffix: true })})
            </span>
          </div>
          
          {post.title && (
            <h3 className="font-medium text-lg mb-2">{post.title}</h3>
          )}
          
          {post.content && (
            <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">
              {post.content}
            </p>
          )}
          
          {post.sliceOfLife && (
            <div className="mt-3">
              <span className="inline-flex items-center px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                {post.sliceOfLife.name}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 ml-4">
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
