export const dynamic = 'force-dynamic';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Tag, Users } from "lucide-react";
import { getLabels } from "@/lib/actions/labels";
import { LabelForm } from "@/components/features/label-form";

export default async function LabelsPage() {
  const labels = await getLabels();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Labels
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Organize your contacts with custom labels.
          </p>
        </div>
      </div>

      {/* Create new label form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5" />
            Create New Label
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LabelForm />
        </CardContent>
      </Card>

      {/* Labels list */}
      {labels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
              <Tag className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No labels yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              Create labels to organize your contacts. For example: &quot;Family&quot;,
              &quot;Work&quot;, &quot;Friends&quot;, &quot;VIP&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {labels.map((label) => (
            <Link key={label.id} href={`/labels/${label.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: label.bgColor }}
                      >
                        <Tag
                          className="h-5 w-5"
                          style={{ color: label.textColor }}
                        />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {label.name}
                        </h3>
                        {label.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {label.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="h-4 w-4" />
                      {label._count.contacts}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
