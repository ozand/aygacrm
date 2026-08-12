"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MergeQueue } from "@/components/features/merge-queue";

export function PossibleDuplicatesSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Possible Duplicates</h2>
        <Button size="sm" variant="outline" onClick={() => setIsExpanded((prev) => !prev)}>
          {isExpanded ? <ChevronDown className="mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
          {isExpanded ? "Hide" : "Check for Duplicates"}
        </Button>
      </div>

      {isExpanded && (
        <div className="rounded-lg border bg-background p-3">
          <MergeQueue />
        </div>
      )}

      {!isExpanded && <div className="flex items-center text-xs text-muted-foreground"><ChevronRight className="mr-1 h-3 w-3" />Expand to review possible duplicates</div>}
    </section>
  );
}
