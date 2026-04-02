"use client";

import { useTransition, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import { createDocument, deleteDocument } from "@/lib/actions/documents";

interface DocumentItem {
  id: string;
  name: string;
  originalUrl: string;
  mimeType: string | null;
  size: number | null;
  createdAt: Date;
}

interface DocumentFormProps {
  contactId: string;
  existingDocuments: DocumentItem[];
}

export function DocumentForm({ contactId, existingDocuments }: DocumentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      // Upload file via API
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("type", "document");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const { url } = await response.json();

      // Create document record
      const formData = new FormData();
      formData.set("contactId", contactId);
      formData.set("name", file.name);
      formData.set("originalUrl", url);
      formData.set("mimeType", file.type);
      formData.set("size", file.size.toString());

      startTransition(async () => {
        const result = await createDocument(formData);
        if (!result.success) {
          setError(result.error || "Failed to save document");
        }
      });
    } catch (err) {
      setError("Failed to upload file");
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = (docId: string) => {
    startTransition(async () => {
      await deleteDocument(docId);
    });
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith("image/")) return FileImage;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
      return FileSpreadsheet;
    }
    if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml")) {
      return FileCode;
    }
    if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
      return FileText;
    }
    return File;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const disabled = isPending || isUploading;

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50" : ""}`}>
      {/* Document list */}
      {existingDocuments.length > 0 && (
        <div className="space-y-2">
          {existingDocuments.map((doc) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {doc.size && <span>{formatFileSize(doc.size)}</span>}
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8"
                  >
                    <a
                      href={doc.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.name}
                    >
                      <Download className="h-4 w-4 text-blue-500" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
                    disabled={disabled}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {existingDocuments.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No documents attached. Upload files related to this contact.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Upload button */}
      <div>
        <Input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
          id="document-upload"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {isUploading ? "Uploading..." : "Upload Document"}
        </Button>
      </div>
    </div>
  );
}
