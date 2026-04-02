"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Loader2,
  Users,
  FileText,
  Calendar,
  CheckSquare,
  Bell,
  Gift,
  Phone,
  BookOpen,
} from "lucide-react";
import { exportData, getExportStats, ExportOptions } from "@/lib/actions/export";
import { exportContactsToVCard } from "@/lib/actions/export-contacts";

interface Stats {
  contacts: number;
  notes: number;
  activities: number;
  tasks: number;
  reminders: number;
  gifts: number;
  calls: number;
  journals: number;
}

const EXPORT_ITEMS = [
  { key: "includeContacts", label: "Contacts", icon: Users, statsKey: "contacts" },
  { key: "includeNotes", label: "Notes", icon: FileText, statsKey: "notes" },
  { key: "includeActivities", label: "Activities", icon: Calendar, statsKey: "activities" },
  { key: "includeTasks", label: "Tasks", icon: CheckSquare, statsKey: "tasks" },
  { key: "includeReminders", label: "Reminders", icon: Bell, statsKey: "reminders" },
  { key: "includeGifts", label: "Gifts", icon: Gift, statsKey: "gifts" },
  { key: "includeCalls", label: "Calls", icon: Phone, statsKey: "calls" },
  { key: "includeJournals", label: "Journals", icon: BookOpen, statsKey: "journals" },
] as const;

export function ExportManager() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<"json" | "csv" | "vcard">("json");
  const [options, setOptions] = useState<Record<string, boolean>>({
    includeContacts: true,
    includeNotes: true,
    includeActivities: true,
    includeTasks: true,
    includeReminders: true,
    includeGifts: true,
    includeCalls: true,
    includeJournals: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    // When format changes to CSV or vCard, only select includeContacts
    if (format === "csv" || format === "vcard") {
      setOptions({
        includeContacts: true,
        includeNotes: false,
        includeActivities: false,
        includeTasks: false,
        includeReminders: false,
        includeGifts: false,
        includeCalls: false,
        includeJournals: false,
      });
    } else {
      // For JSON, ensure all are selected by default
      selectAll();
    }
  }, [format]);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await getExportStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  function toggleOption(key: string) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAll() {
    const allSelected: Record<string, boolean> = {};
    EXPORT_ITEMS.forEach((item) => {
      allSelected[item.key] = true;
    });
    setOptions(allSelected);
  }

  function selectNone() {
    const noneSelected: Record<string, boolean> = {};
    EXPORT_ITEMS.forEach((item) => {
      noneSelected[item.key] = false;
    });
    setOptions(noneSelected);
  }

  async function handleExport() {
    try {
      setExporting(true);
      setError(null);

      const exportOptions: ExportOptions = {
        ...options,
        format,
      };

      let fileContent: string;
      let filename: string;
      let mimeType: string;

      if (format === "vcard") {
        fileContent = await exportContactsToVCard();
        filename = "monica-contacts.vcf";
        mimeType = "text/vcard";
      } else {
        const result = await exportData(exportOptions);
        fileContent = result.data;
        filename = result.filename;
        mimeType = result.mimeType;
      }
      

      // Create download
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setExporting(false);
    }
  }

  const hasAnySelected = Object.values(options).some(Boolean);
  const totalItems = stats
    ? EXPORT_ITEMS.reduce((sum, item) => {
        if (options[item.key]) {
          return sum + (stats[item.statsKey as keyof Stats] || 0);
        }
        return sum;
      }, 0)
    : 0;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Data
        </CardTitle>
        <CardDescription>
          Download your data in JSON or CSV format. You can select which data to include.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error display */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Format selector */}
            <div className="flex items-center gap-4">
              <Label>Export Format:</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "json" | "csv" | "vcard")}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (Full)</SelectItem>
                  <SelectItem value="csv">CSV (Contacts)</SelectItem>
                  <SelectItem value="vcard">vCard (Contacts)</SelectItem>
                </SelectContent>
              </Select>
              {(format === "csv" || format === "vcard") && (
                <span className="text-xs text-gray-500">
                  {format.toUpperCase()} exports contacts only with basic fields
                </span>
              )}
            </div>

            {/* Quick select buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={selectNone}>
                Select None
              </Button>
            </div>

            {/* Data selection grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EXPORT_ITEMS.map((item) => {
                const Icon = item.icon;
                const count = stats?.[item.statsKey as keyof Stats] || 0;
                const isChecked = options[item.key];

                 return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/5 border-primary/30"
                        : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOption(item.key)}
                      disabled={(format === "csv" || format === "vcard") && item.key !== "includeContacts"}
                    />
                    <Icon
                      className={`h-4 w-4 ${
                        isChecked ? "text-primary" : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-gray-500 ml-2">({count})</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Export button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-gray-500">
                {hasAnySelected
                  ? `${totalItems} items will be exported`
                  : "Select data to export"}
              </span>
              <Button onClick={handleExport} disabled={!hasAnySelected || exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export {format.toUpperCase()}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
