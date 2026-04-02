export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Users, Plus, ArrowRight } from "lucide-react";
import { getGroups, getGroupTypes } from "@/lib/actions/groups";
import { GroupManager } from "@/components/features/group-manager";

export default async function GroupsPage() {
  const groups = await getGroups();
  const groupTypes = await getGroupTypes();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Groups
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Organize your contacts into groups
          </p>
        </div>
      </div>

      {/* Groups Manager */}
      <Suspense fallback={<div>Loading...</div>}>
        <GroupManager groups={groups} groupTypes={groupTypes} />
      </Suspense>

      {/* Groups List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.length > 0 ? (
          groups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    {group.name}
                  </CardTitle>
                  {group.groupType && (
                    <Badge variant="secondary" className="text-xs">
                      {group.groupType.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{group.contacts.length} contacts</span>
                  </div>
                </div>

                {/* Member preview */}
                {group.contacts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {group.contacts.slice(0, 5).map((membership) => (
                      <Link
                        key={membership.contact.id}
                        href={`/contacts/${membership.contact.id}`}
                        className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                      >
                        {[
                          membership.contact.firstName,
                          membership.contact.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "Unnamed"}
                        {membership.role && (
                          <span className="text-muted-foreground ml-1">
                            ({membership.role.label})
                          </span>
                        )}
                      </Link>
                    ))}
                    {group.contacts.length > 5 && (
                      <span className="text-xs text-muted-foreground px-2 py-1">
                        +{group.contacts.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No groups yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create groups to organize your contacts by categories, projects,
                or any other criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
