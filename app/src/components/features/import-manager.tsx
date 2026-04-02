"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Loader2,
  FileJson,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Users,
  FileText,
  Calendar,
  CheckSquare,
  Gift,
  Phone,
  BookOpen,
} from "lucide-react";
import { importData, previewImport, ImportResult } from "@/lib/actions/import";
import { importContactsFromCSV, importContactsFromVCard } from "@/lib/actions/import-contacts";

interface PreviewData {
  valid: boolean;
  counts: {
    contacts: number;
    notes: number;
    activities: number;
    tasks: number;
    gifts: number;
    calls: number;
    journals: number;
  };
  errors: string[];
  fileType?: "json" | "csv" | "vcard";
}

const DATA_TYPES = [
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "activities", label: "Activities", icon: Calendar },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "gifts", label: "Gifts", icon: Gift },
  { key: "calls", label: "Calls", icon: Phone },
  { key: "journals", label: "Journals", icon: BookOpen },
] as const;

export function ImportManager() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [skipExisting, setSkipExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

   async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    let fileType: "json" | "csv" | "vcard" | null = null;

    if (fileName.endsWith(".json")) {
      fileType = "json";
    } else if (fileName.endsWith(".csv")) {
      fileType = "csv";
    } else if (fileName.endsWith(".vcf")) {
      fileType = "vcard";
    } else {
      setError("Please select a JSON (.json), CSV (.csv), or vCard (.vcf) file.");
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB)");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      // Read file content
      const content = await selectedFile.text();
      setFileContent(content);

      let previewResult: PreviewData;
      if (fileType === "json") {
        previewResult = { ...(await previewImport(content)), fileType: "json" };
      } else if (fileType === "csv") {
        // For CSV, we can do a simple preview by counting rows and assuming contacts
        const lines = content.split(/\r?\n/).filter(Boolean);
        previewResult = {
          valid: lines.length > 1,
          counts: { contacts: Math.max(0, lines.length - 1), notes: 0, activities: 0, tasks: 0, gifts: 0, calls: 0, journals: 0 },
          errors: lines.length <= 1 ? ["CSV file is empty or has no data rows"] : [],
          fileType: "csv",
        };
      } else if (fileType === "vcard") {
        // For vCard, we can count BEGIN:VCARD blocks
        const vcardCount = (content.match(/BEGIN:VCARD/gi) || []).length;
        previewResult = {
          valid: vcardCount > 0,
          counts: { contacts: vcardCount, notes: 0, activities: 0, tasks: 0, gifts: 0, calls: 0, journals: 0 },
          errors: vcardCount === 0 ? ["No valid vCards found in file"] : [],
          fileType: "vcard",
        };
      } else {
        previewResult = { valid: false, counts: { contacts: 0, notes: 0, activities: 0, tasks: 0, gifts: 0, calls: 0, journals: 0 }, errors: ["Unsupported file type"], fileType: undefined };
      }
      setPreview(previewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!fileContent || !file || !preview) return;

    setImporting(true);
    setError(null);

    try {
      let importResult: ImportResult;
      if (preview.fileType === "json") {
        importResult = await importData(fileContent, { skipExisting });
      } else if (preview.fileType === "csv") {
        const result = await importContactsFromCSV(fileContent);
        // Map CSV import result to general ImportResult structure
        importResult = {
          success: result.success,
          imported: { contacts: result.imported, notes: 0, activities: 0, tasks: 0, gifts: 0, calls: 0, journals: 0 },
          errors: result.errors,
          warnings: [],
        };
      } else if (preview.fileType === "vcard") {
        const result = await importContactsFromVCard(fileContent);
        // Map vCard import result to general ImportResult structure
        importResult = {
          success: result.success,
          imported: { contacts: result.imported, notes: 0, activities: 0, tasks: 0, gifts: 0, calls: 0, journals: 0 },
          errors: result.errors,
          warnings: [],
        };
      } else {
        setError("Unsupported file type for import.");
        setImporting(false);
        return;
      }
      setResult(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setFile(null);
    setFileContent(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const totalPreviewItems = preview
    ? Object.values(preview.counts).reduce((a, b) => a + b, 0)
    : 0;

  const totalImported = result
    ? Object.values(result.imported).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Data
        </CardTitle>
        <CardDescription>
          Import data from a Monica JSON export file. This will add new data to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error display */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success result */}
        {result?.success && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Import completed successfully!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {DATA_TYPES.map((type) => {
                const count = result.imported[type.key as keyof typeof result.imported];
                if (count === 0) return null;
                const Icon = type.icon;
                return (
                  <div key={type.key} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Icon className="h-4 w-4" />
                    <span>{count} {type.label.toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {result.warnings.length} warning(s)
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 max-h-24 overflow-y-auto">
                  {result.warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {result.warnings.length > 10 && (
                    <li className="italic">...and {result.warnings.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              Import Another File
            </Button>
          </div>
        )}

        {/* Failed result */}
        {result && !result.success && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Import failed</span>
            </div>
            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Try Again
            </Button>
          </div>
        )}

        {/* File selection - only show if no result */}
        {!result && (
          <>
            {/* File input */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.vcf"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file"
              />

              {!file ? (
                <label
                  htmlFor="import-file"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <FileJson className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Click to select a file
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      JSON, CSV, or vCard file (max 10MB)
                    </p>
                  </div>
                </label>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileJson className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Change file
                  </Button>
                </div>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Analyzing file...</span>
              </div>
            )}

            {/* Preview */}
            {preview && !loading && (
              <div className="space-y-4">
                {!preview.valid ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                      Invalid file format
                    </p>
                    <ul className="text-sm text-red-500 dark:text-red-400 space-y-1">
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    {/* Data preview */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        File contains {totalPreviewItems} items:
                      </p>
                      {preview.fileType === "json" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {DATA_TYPES.map((type) => {
                            const count = preview.counts[type.key as keyof typeof preview.counts];
                            const Icon = type.icon;
                            return (
                              <div
                                key={type.key}
                                className={`flex items-center gap-2 p-2 rounded ${
                                  count > 0
                                    ? "bg-white dark:bg-gray-800 shadow-sm"
                                    : "opacity-50"
                                }`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${
                                    count > 0 ? "text-primary" : "text-gray-400"
                                  }`}
                                />
                                <div>
                                  <span className="text-sm font-medium">{count}</span>
                                  <span className="text-xs text-gray-500 ml-1">
                                    {type.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(preview.fileType === "csv" || preview.fileType === "vcard") && (
                        <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 shadow-sm">
                          <Users className="h-4 w-4 text-primary" />
                          <div>
                            <span className="text-sm font-medium">{preview.counts.contacts}</span>
                            <span className="text-xs text-gray-500 ml-1">
                              {preview.fileType === "csv" ? "Contacts (CSV)" : "Contacts (vCard)"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="skip-existing"
                        checked={skipExisting}
                        onCheckedChange={(checked) => setSkipExisting(checked === true)}
                      />
                      <Label htmlFor="skip-existing" className="text-sm cursor-pointer">
                        Skip contacts that already exist (match by name)
                      </Label>
                    </div>

                    {/* Import button */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm text-gray-500">
                        Ready to import {totalPreviewItems} items
                      </span>
                      <Button onClick={handleImport} disabled={importing}>
                        {importing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Import Data
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
