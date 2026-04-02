"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Edit, Smile, Meh, Frown } from "lucide-react";
import { deleteNote } from "@/lib/actions/notes";

interface Emotion {
  id: string;
  name: string;
  type: string;
}

interface Note {
  id: number;
  title?: string | null;
  body: string;
  createdAt: Date;
  author?: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  emotion?: Emotion | null;
}

interface NotesListProps {
  notes: Note[];
  onEdit?: (note: Note) => void;
}

export function NotesList({ notes, onEdit }: NotesListProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(noteId: number) {
    if (confirm("Are you sure you want to delete this note?")) {
      startTransition(async () => {
        await deleteNote(noteId);
      });
    }
  }

  const getEmotionIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <Smile className="h-3 w-3" />;
      case "negative":
        return <Frown className="h-3 w-3" />;
      default:
        return <Meh className="h-3 w-3" />;
    }
  };

  const getEmotionVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "positive":
        return "default";
      case "negative":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (notes.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-sm italic py-4">
        No notes yet. Add your first note above.
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {notes.map((note) => {
        const authorName = note.author
          ? [note.author.firstName, note.author.lastName]
              .filter(Boolean)
              .join(" ") || note.author.email
          : "Unknown";

        return (
          <div
            key={note.id}
            className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 py-2 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {note.title && (
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {note.title}
                    </h4>
                  )}
                  {note.emotion && (
                    <Badge variant={getEmotionVariant(note.emotion.type)} className="text-xs">
                      {getEmotionIcon(note.emotion.type)}
                      <span className="ml-1">{note.emotion.name}</span>
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {note.body}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{authorName}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Note actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(note)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => handleDelete(note.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
