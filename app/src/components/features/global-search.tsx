"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  FileText,
  CheckCircle,
  Globe,
  Tags,
  FolderOpen,
  Loader2,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/lib/actions/search";

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  contact: Users,
  note: FileText,
  task: CheckCircle,
  activity: Globe,
  group: FolderOpen,
  label: Tags,
  postTag: BookOpen,
  postPhoto: BookOpen,
  externalRecord: ExternalLink,
};

const typeLabels: Record<string, string> = {
  contact: "Contact",
  note: "Note",
  task: "Task",
  activity: "Activity",
  group: "Group",
  label: "Label",
  postTag: "Journal Tag",
  postPhoto: "Journal Photo",
  externalRecord: "External Record",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("open-global-search", handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("open-global-search", handleOpen);
    };
  }, []);

  // Search on query change
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        const searchResults = await globalSearch(query);
        setResults(searchResults);
        setSelectedIndex(0);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      router.push(url);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].url);
    }
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const group = typeLabels[result.type] || result.type;
    if (!acc[group]) acc[group] = [];
    acc[group].push(result);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden h-5 select-none items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500 sm:inline-flex dark:border-gray-700 dark:bg-gray-800">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          {/* Search input */}
          <div className="flex items-center border-b border-gray-200 px-3 dark:border-gray-700">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <Input
              placeholder="Search contacts, notes, tasks, records..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            {isPending && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {query.length >= 2 && !isPending && results.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}

            {query.length < 2 && (
              <p className="py-6 text-center text-sm text-gray-500">
                Type at least 2 characters to search
              </p>
            )}

            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {groupName}s
                </div>
                {items.map((result) => {
                  const Icon = typeIcons[result.type] || Globe;
                  const currentIndex = flatIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => navigate(result.url)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-gray-100 dark:bg-gray-800"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-gray-900 dark:text-white">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      {result.matchedField && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {result.matchedField}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hints */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 border-t border-gray-200 px-3 py-2 text-xs text-gray-400 dark:border-gray-700">
              <span>
                <kbd className="font-mono">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono">esc</kbd> close
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
