"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tag, Plus, X, Check } from "lucide-react";
import {
  addLabelToContact,
  removeLabelFromContact,
} from "@/lib/actions/labels";
import Link from "next/link";

interface Label {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
}

interface ContactLabelsProps {
  contactId: string;
  currentLabels: Array<{
    label: Label;
  }>;
  availableLabels: Label[];
}

export function ContactLabels({
  contactId,
  currentLabels,
  availableLabels,
}: ContactLabelsProps) {
  const [isPending, startTransition] = useTransition();
  const [labels, setLabels] = useState(currentLabels);

  const currentLabelIds = labels.map((l) => l.label.id);
  const unassignedLabels = availableLabels.filter(
    (l) => !currentLabelIds.includes(l.id)
  );

  function handleAddLabel(labelId: string) {
    const label = availableLabels.find((l) => l.id === labelId);
    if (!label) return;

    // Optimistic update
    setLabels((prev) => [...prev, { label }]);

    startTransition(async () => {
      const result = await addLabelToContact(contactId, labelId);
      if (!result.success) {
        // Rollback on error
        setLabels((prev) => prev.filter((l) => l.label.id !== labelId));
      }
    });
  }

  function handleRemoveLabel(labelId: string) {
    // Optimistic update
    setLabels((prev) => prev.filter((l) => l.label.id !== labelId));

    startTransition(async () => {
      const result = await removeLabelFromContact(contactId, labelId);
      if (!result.success) {
        // Rollback on error
        const label = availableLabels.find((l) => l.id === labelId);
        if (label) {
          setLabels((prev) => [...prev, { label }]);
        }
      }
    });
  }

  return (
    <div className={`space-y-3 ${isPending ? "opacity-50" : ""}`}>
      {/* Current labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map(({ label }) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: label.bgColor, color: label.textColor }}
            >
              <Tag className="h-3 w-3" />
              {label.name}
              <button
                type="button"
                onClick={() => handleRemoveLabel(label.id)}
                className="ml-1 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add label dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add Label
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {unassignedLabels.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-gray-500">
              {availableLabels.length === 0 ? (
                <>
                  No labels yet.{" "}
                  <Link href="/labels" className="text-primary hover:underline">
                    Create one
                  </Link>
                </>
              ) : (
                "All labels assigned"
              )}
            </div>
          ) : (
            unassignedLabels.map((label) => (
              <DropdownMenuItem
                key={label.id}
                onClick={() => handleAddLabel(label.id)}
                className="flex items-center gap-2"
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: label.bgColor }}
                />
                {label.name}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/labels" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Manage labels
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
