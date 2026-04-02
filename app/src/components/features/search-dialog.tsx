"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  User,
  FileText,
  CheckSquare,
  Activity,
  FolderOpen,
  Tag,
  Loader2,
  Image,
  BookOpen, // For PostTags related to Journals
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/lib/actions/search";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  contact: User,
  note: FileText,
  task: CheckSquare,
  activity: Activity,
  group: FolderOpen,
  label: Tag,
  postTag: BookOpen, // Using BookOpen for journal tags
  postPhoto: Image,
};

const TYPE_COLORS: Record<string, string> = {
  contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  note: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  task: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  activity: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  group: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  label: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  postTag: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  postPhoto: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const searchResults = await globalSearch(query);
        setResults(searchResults);
        setSelectedIndex(0);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        router.push(results[selectedIndex].url);
        onOpenChange(false);
      }
    },
    [results, selectedIndex, router, onOpenChange]
  );

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search contacts, notes, tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 px-0 text-base"
            autoFocus
          />
          {isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Type at least 2 characters to search</p>
              <p className="text-xs mt-2">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl</kbd> +{" "}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">K</kbd> anytime to open search
              </p>
            </div>
          ) : results.length === 0 && !isPending ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No results found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = TYPE_ICONS[result.type] || User;
                const colorClass = TYPE_COLORS[result.type] || "";
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      {(result.subtitle || result.matchedField) && (
                        <p className="text-sm text-muted-foreground truncate">
                          {result.matchedField || result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-background rounded border">↑</kbd>{" "}
                <kbd className="px-1.5 py-0.5 bg-background rounded border">↓</kbd>{" "}
                to navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background rounded border">Enter</kbd>{" "}
                to open
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd>{" "}
                to close
              </span>
            </div>
            <span>{results.length} results</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
