export const dynamic = 'force-dynamic';

import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Loader2 } from "lucide-react";
import { getContacts } from "@/lib/actions/contacts";
import { ContactCard } from "@/components/features/contact-card";
import { SearchContacts } from "@/components/features/search-contacts";
import { ExportContacts } from "@/components/features/export-contacts";
import { ImportContacts } from "@/components/features/import-contacts";

interface ContactsPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function ContactsList({ query }: { query?: string }) {
  const contacts = await getContacts(query);

  if (contacts.length === 0) {
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

  return (
    <>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
        {query && ` matching "${query}"`}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
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
  const { q: query } = await searchParams;

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

      {/* Search */}
      <div className="flex items-center gap-4">
        <Suspense fallback={<div className="h-10 w-64 bg-gray-100 rounded-md animate-pulse" />}>
          <SearchContacts initialQuery={query} />
        </Suspense>
      </div>

      {/* Contacts list */}
      <Suspense fallback={<ContactsListSkeleton />}>
        <ContactsList query={query} />
      </Suspense>
    </div>
  );
}
