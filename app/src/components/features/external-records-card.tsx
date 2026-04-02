"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ExternalLink, Plus } from "lucide-react";
import { addExternalRecord, deleteExternalRecord } from "@/lib/actions/external-records";
import { SOURCES, VALID_SOURCE_KINDS, type Source, type Kind } from "@/lib/ingestion-conventions";

interface ExternalRecordItem {
  id: string;
  source: string;
  kind: string;
  externalId: string | null;
  url: string | null;
  title: string | null;
  content: string | null;
  happenedAt: Date | null;
  createdAt: Date;
}

interface ExternalRecordsCardProps {
  contactId: string;
  existingRecords: ExternalRecordItem[];
}

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPreview(content: string | null): string | null {
  if (!content) {
    return null;
  }

  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 180)}...`;
}

export function ExternalRecordsCard({ contactId, existingRecords }: ExternalRecordsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [records, setRecords] = useState<ExternalRecordItem[]>(existingRecords);
  const [source, setSource] = useState<Source>("other");
  const [kind, setKind] = useState<string>(VALID_SOURCE_KINDS.other[0]);

  // Get valid kinds for the current source
  const validKinds = useMemo(() => VALID_SOURCE_KINDS[source], [source]);

  // When source changes, reset kind to the first valid kind for that source
  const handleSourceChange = (newSource: Source) => {
    setSource(newSource);
    const kinds = VALID_SOURCE_KINDS[newSource];
    if (!kinds.includes(kind as Kind)) {
      setKind(kinds[0]);
    }
  };
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [externalId, setExternalId] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecords(existingRecords);
  }, [existingRecords]);

  const groupedRecords = useMemo(() => {
    const grouped: Record<string, ExternalRecordItem[]> = {};
    for (const record of records) {
      if (!grouped[record.source]) {
        grouped[record.source] = [];
      }
      grouped[record.source].push(record);
    }
    return grouped;
  }, [records]);

  const canSubmit =
    source.trim() && kind.trim() && (title.trim() || url.trim() || content.trim() || externalId.trim());

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Source, kind, and at least one content field are required.");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("source", source.trim());
    formData.set("kind", kind.trim());
    if (title.trim()) formData.set("title", title.trim());
    if (url.trim()) formData.set("url", url.trim());
    if (content.trim()) formData.set("content", content.trim());
    if (externalId.trim()) formData.set("externalId", externalId.trim());
    if (happenedAt.trim()) formData.set("happenedAt", happenedAt.trim());

    startTransition(async () => {
      const result = await addExternalRecord(formData);
      if (!result.success) {
        setError(result.error || "Failed to add record");
        return;
      }

      const data = result.data as ExternalRecordItem;
      if (data?.id) {
        setRecords((prev) => [data, ...prev]);
      }

      setSource("other");
      setKind(VALID_SOURCE_KINDS.other[0]);
      setTitle("");
      setUrl("");
      setContent("");
      setExternalId("");
      setHappenedAt("");
    });
  };

  const handleDelete = (recordId: string) => {
    setError(null);

    const previous = records;
    setRecords((prev) => prev.filter((record) => record.id !== recordId));

    startTransition(async () => {
      const result = await deleteExternalRecord(recordId);
      if (!result.success) {
        setRecords(previous);
        setError(result.error || "Failed to delete record");
      }
    });
  };

  return (
    <div className="space-y-4">
        {Object.keys(groupedRecords).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No external records yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRecords).map(([sourceName, sourceRecords]) => (
              <div key={sourceName} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {sourceName}
                </p>
                {sourceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{record.source}</Badge>
                          <Badge variant="outline">{record.kind}</Badge>
                        </div>
                        {record.title && <p className="text-sm font-medium">{record.title}</p>}
                        {getPreview(record.content) && (
                          <p className="text-xs text-gray-600 dark:text-gray-300">{getPreview(record.content)}</p>
                        )}
                        {record.url && (
                          <a
                            href={record.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open link
                          </a>
                        )}
                        {record.happenedAt && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Happened: {formatDateTime(record.happenedAt)}
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => handleDelete(record.id)}
                        aria-label="Delete external record"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border p-3 dark:border-gray-800">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="external-record-source">Source *</Label>
              <select
                id="external-record-source"
                value={source}
                onChange={(e) => handleSourceChange(e.target.value as Source)}
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="external-record-kind">Kind *</Label>
              <select
                id="external-record-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validKinds.map((k: string) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              disabled={isPending}
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="External ID (optional)"
              disabled={isPending}
            />
            <Input
              type="datetime-local"
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
              disabled={isPending}
            />
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content snippet or transcript"
            rows={3}
            disabled={isPending}
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" disabled={isPending || !canSubmit}>
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </form>
    </div>
  );
}
