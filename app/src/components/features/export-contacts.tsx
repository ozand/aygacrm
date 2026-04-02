"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportContactsToCSV, exportContactsToVCard } from "@/lib/actions/export-contacts";

export function ExportContacts() {
  const [isPending, startTransition] = useTransition();

  const handleExport = (format: "csv" | "vcard") => {
    startTransition(async () => {
      try {
        let content: string;
        let filename: string;
        let mimeType: string;

        if (format === "csv") {
          content = await exportContactsToCSV();
          filename = `contacts-${getDateString()}.csv`;
          mimeType = "text/csv";
        } else {
          content = await exportContactsToVCard();
          filename = `contacts-${getDateString()}.vcf`;
          mimeType = "text/vcard";
        }

        // Create and download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export contacts. Please try again.");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("vcard")}>
          <FileText className="mr-2 h-4 w-4" />
          Export as vCard (.vcf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
