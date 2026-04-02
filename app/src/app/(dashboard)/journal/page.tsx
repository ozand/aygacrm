export const dynamic = 'force-dynamic';

import { getJournals } from "@/lib/actions/journal";
import { JournalForm, JournalCard } from "@/components/features/journal-form";
import { BookOpen } from "lucide-react";

export default async function JournalPage() {
  const journals = await getJournals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journal</h1>
          <p className="text-muted-foreground">
            Write your thoughts and track your life
          </p>
        </div>
        <JournalForm />
      </div>

      {journals.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No journals yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first journal to start writing
          </p>
          <JournalForm />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journals.map((journal) => (
            <JournalCard key={journal.id} journal={journal} />
          ))}
        </div>
      )}
    </div>
  );
}
