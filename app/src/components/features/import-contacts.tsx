"use client";

import { useTransition, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { importContactsFromCSV, importContactsFromVCard, ImportResult } from "@/lib/actions/import-contacts";

export function ImportContacts() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) return;

    startTransition(async () => {
      try {
        const content = await selectedFile.text();
        const filename = selectedFile.name.toLowerCase();

        let importResult: ImportResult;

        if (filename.endsWith(".csv")) {
          importResult = await importContactsFromCSV(content);
        } else if (filename.endsWith(".vcf") || filename.endsWith(".vcard")) {
          importResult = await importContactsFromVCard(content);
        } else {
          importResult = {
            success: false,
            imported: 0,
            skipped: 0,
            errors: ["Unsupported file format. Please use CSV or VCF files."],
          };
        }

        setResult(importResult);

        if (importResult.success && importResult.imported > 0) {
          // Reset after successful import
          setTimeout(() => {
            setSelectedFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }, 2000);
        }
      } catch (error) {
        setResult({
          success: false,
          imported: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : "Failed to import contacts"],
        });
      }
    });
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV or vCard (.vcf) file to import contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.vcf,.vcard"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="flex-1 flex items-center justify-center px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="text-center">
                  <div className="flex justify-center gap-2 mb-2">
                    <FileSpreadsheet className="h-8 w-8 text-gray-400" />
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFile ? selectedFile.name : "Click to select a file"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports CSV and vCard (.vcf) formats
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Result display */}
          {result && (
            <div
              className={`p-4 rounded-lg ${
                result.success && result.errors.length === 0
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : result.errors.length > 0
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success && result.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {result.imported > 0
                      ? `Imported ${result.imported} contact${result.imported !== 1 ? "s" : ""}`
                      : "No contacts imported"}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Skipped {result.skipped} row{result.skipped !== 1 ? "s" : ""} (missing name)
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                        {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:
                      </p>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-h-24 overflow-y-auto">
                        {result.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>• ...and {result.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {result?.success ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
