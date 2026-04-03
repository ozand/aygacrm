export const dynamic = 'force-dynamic';

import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getContacts, getLabels, getGroups } from "@/lib/actions/contacts";
import { ContactCard } from "@/components/features/contact-card";
import { SearchContacts } from "@/components/features/search-contacts";
import { ExportContacts } from "@/components/features/export-contacts";
import { ImportContacts } from "@/components/features/import-contacts";
import { PossibleDuplicatesSection } from "@/components/features/possible-duplicates-section";

interface ContactsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    order?: string;
    label?: string;
    group?: string;
  }>;
}

async function ContactFilters({
  currentLabel,
  currentGroup,
  currentSort,
  currentOrder,
  searchQuery,
}: {
  currentLabel?: string;
  currentGroup?: string;
  currentSort?: string;
  currentOrder?: string;
  searchQuery?: string;
}) {
  const [labels, groups] = await Promise.all([getLabels(), getGroups()]);

  function buildUrl(params: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (searchQuery) p.set("q", searchQuery);
    if (params.sort || currentSort) p.set("sort", params.sort || currentSort || "name");
    if (params.order || currentOrder) p.set("order", params.order || currentOrder || "asc");
    if (params.label !== undefined ? params.label : currentLabel)
      p.set("label", params.label !== undefined ? params.label! : currentLabel!);
    if (params.group !== undefined ? params.group : currentGroup)
      p.set("group", params.group !== undefined ? params.group! : currentGroup!);
    const qs = p.toString();
    return `/contacts${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sort */}
      <div className="flex items-center gap-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Sort:</span>
        {(["name", "updated", "created"] as const).map((s) => (
          <Link
            key={s}
            href={buildUrl({
              sort: s,
              order: s === currentSort && currentOrder === "asc" ? "desc" : "asc",
            })}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              (currentSort || "name") === s
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {(currentSort || "name") === s && (
              <span className="ml-1">{currentOrder === "desc" ? "\u2193" : "\u2191"}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Label filter */}
      {labels.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400 ml-2">Label:</span>
          <Link
            href={buildUrl({ label: "" })}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              !currentLabel
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All
          </Link>
          {labels.slice(0, 5).map((label) => (
            <Link
              key={label.id}
              href={buildUrl({ label: label.id })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                currentLabel === label.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {label.name} ({label._count.contacts})
            </Link>
          ))}
        </div>
      )}

      {/* Group filter */}
      {groups.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400 ml-2">Group:</span>
          <Link
            href={buildUrl({ group: "" })}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              !currentGroup
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All
          </Link>
          {groups.slice(0, 5).map((group) => (
            <Link
              key={group.id}
              href={buildUrl({ group: group.id })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                currentGroup === group.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {group.name} ({group._count.contacts})
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function ContactsList({
  query,
  page,
  sort,
  order,
  labelId,
  groupId,
}: {
  query?: string;
  page: number;
  sort?: string;
  order?: string;
  labelId?: string;
  groupId?: string;
}) {
  const result = await getContacts({
    search: query,
    page,
    pageSize: 24,
    sortBy: (sort as "name" | "updated" | "created") || "name",
    sortOrder: (order as "asc" | "desc") || "asc",
    labelId,
    groupId,
  });

  if (result.contacts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {query ? "No contacts found" : "No contacts yet"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-4">
            {query
              ? `No contacts match "${query}". Try a different search term.`
              : "Start building your personal CRM by adding your first contact. Keep track of birthdays, relationships, and important moments."}
          </p>
          {!query && (
            <Button asChild>
              <Link href="/contacts/new">
                <Plus className="mr-2 h-4 w-4" />
                Add your first contact
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Build pagination URLs
  function paginationUrl(p: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (p > 1) params.set("page", p.toString());
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);
    if (labelId) params.set("label", labelId);
    if (groupId) params.set("group", groupId);
    const qs = params.toString();
    return `/contacts${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {result.total} contact{result.total !== 1 ? "s" : ""}
          {query && ` matching "${query}"`}
          {result.totalPages > 1 && ` — page ${result.page} of ${result.totalPages}`}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {result.contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {result.page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={paginationUrl(result.page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(result.totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (result.totalPages <= 7) {
                pageNum = i + 1;
              } else if (result.page <= 4) {
                pageNum = i + 1;
              } else if (result.page >= result.totalPages - 3) {
                pageNum = result.totalPages - 6 + i;
              } else {
                pageNum = result.page - 3 + i;
              }
              return (
                <Link
                  key={pageNum}
                  href={paginationUrl(pageNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors ${
                    pageNum === result.page
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {pageNum}
                </Link>
              );
            })}
          </div>

          {result.page < result.totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={paginationUrl(result.page + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function ContactsListSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const {
    q: query,
    page: pageStr,
    sort,
    order,
    label: labelId,
    group: groupId,
  } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Contacts
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your personal and professional relationships.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportContacts />
          <ExportContacts />
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="h-10 w-64 bg-gray-100 rounded-md animate-pulse" />}>
            <SearchContacts initialQuery={query} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <ContactFilters
            currentLabel={labelId}
            currentGroup={groupId}
            currentSort={sort}
            currentOrder={order}
            searchQuery={query}
          />
        </Suspense>
      </div>

      <PossibleDuplicatesSection />

      {/* Contacts list */}
      <Suspense fallback={<ContactsListSkeleton />}>
        <ContactsList
          query={query}
          page={page}
          sort={sort}
          order={order}
          labelId={labelId}
          groupId={groupId}
        />
      </Suspense>
    </div>
  );
}
