export const dynamic = 'force-dynamic';

import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Tag, Users } from "lucide-react";
import { getLabel, getContactsByLabel } from "@/lib/actions/labels";
import { ContactCard } from "@/components/features/contact-card";
import { LabelForm } from "@/components/features/label-form";

interface LabelDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LabelDetailPage({ params }: LabelDetailPageProps) {
  const { id } = await params;
  const label = await getLabel(id);

  if (!label) {
    notFound();
  }

  const contacts = await getContactsByLabel(id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/labels">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: label.bgColor }}
            >
              <Tag className="h-6 w-6" style={{ color: label.textColor }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {label.name}
              </h1>
              {label.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {label.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit label */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Edit className="h-5 w-5" />
            Edit Label
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LabelForm label={label} mode="edit" />
        </CardContent>
      </Card>

      {/* Contacts with this label */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contacts with this label
            <span className="text-sm font-normal text-gray-500">
              ({contacts.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">
              No contacts have this label yet. Add this label to contacts from
              their profile page.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
