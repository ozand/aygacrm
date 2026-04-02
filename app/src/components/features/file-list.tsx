"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileIcon,
  Image,
  User,
  Trash2,
  Download,
  ExternalLink,
} from "lucide-react";
import { deleteFile } from "@/lib/actions/files";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface FileItem {
  id: string;
  uuid: string;
  name: string;
  originalUrl: string;
  mimeType: string | null;
  size: number | null;
  type: string;
  createdAt: Date;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface FileListProps {
  files: FileItem[];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(type: string, mimeType: string | null) {
  if (type === "photo" || type === "avatar" || mimeType?.startsWith("image/")) {
    return <Image className="h-4 w-4" />;
  }
  return <FileIcon className="h-4 w-4" />;
}

function getTypeBadgeColor(type: string) {
  switch (type) {
    case "avatar":
      return "bg-purple-100 text-purple-800";
    case "photo":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function FileList({ files }: FileListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteFile(id);
      router.refresh();
    } catch (error) {
      console.error("Error deleting file:", error);
    } finally {
      setDeletingId(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                {getFileIcon(file.type, file.mimeType)}
                <span className="font-medium truncate max-w-[200px]">
                  {file.name}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className={getTypeBadgeColor(file.type)}>
                {file.type}
              </Badge>
            </TableCell>
            <TableCell>{formatFileSize(file.size)}</TableCell>
            <TableCell>
              {file.contact ? (
                <Link
                  href={`/contacts/${file.contact.id}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <User className="h-3 w-3" />
                  {file.contact.firstName} {file.contact.lastName}
                </Link>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {format(new Date(file.createdAt), "MMM d, yyyy")}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={file.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
