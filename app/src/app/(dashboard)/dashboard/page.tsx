export const dynamic = 'force-dynamic';

import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  FileText,
  Bell,
  Plus,
  ChevronRight,
  Cake,
  Gift,
} from "lucide-react";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { getUpcomingDates } from "@/lib/actions/important-dates";

export default async function DashboardPage() {
  const session = await auth();
  const firstName =
    (session?.user as any)?.firstName ||
    session?.user?.name?.split(" ")[0] ||
    "there";

  const stats = await getDashboardStats();
  const upcomingDates = await getUpcomingDates(30);

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Here&apos;s what&apos;s happening with your contacts today.
          </p>
        </div>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalContacts === 0
                ? "Start adding contacts"
                : `${stats.totalContacts} people in your CRM`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.upcomingEvents === 0
                ? "No events this month"
                : `In the next 30 days`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalNotes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalNotes === 0
                ? "Start taking notes"
                : `Notes about your contacts`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reminders</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeReminders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeReminders === 0
                ? "No active reminders"
                : `Active reminders set`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Contacts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contacts">
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentContacts.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No contacts yet. Create your first contact to get started.
                </p>
                <Button size="sm" asChild>
                  <Link href="/contacts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentContacts.map((contact) => {
                  const name =
                    [contact.firstName, contact.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    contact.nickname ||
                    "Unnamed";
                  const initials = [contact.firstName?.[0], contact.lastName?.[0]]
                    .filter(Boolean)
                    .join("")
                    .toUpperCase() || "?";

                  return (
                    <Link
                      key={contact.id}
                      href={`/contacts/${contact.id}`}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(contact.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingDates || upcomingDates.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No upcoming events. Add birthdays and anniversaries to your
                  contacts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDates.slice(0, 5).map((event: any) => (
                  <Link
                    key={event.id}
                    href={`/contacts/${event.contactId}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        event.isToday
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                          : event.daysUntil <= 7
                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                      }`}
                    >
                      {event.typeName === "birthday" ? (
                        <Cake className="h-5 w-5" />
                      ) : (
                        <Gift className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {event.contactName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.label}
                        {event.age && ` • Turning ${event.age}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          event.isToday
                            ? "text-red-600"
                            : event.daysUntil <= 7
                            ? "text-yellow-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {event.isToday
                          ? "Today!"
                          : event.daysUntil === 1
                          ? "Tomorrow"
                          : `${event.daysUntil} days`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.day}/{event.month}
                      </p>
                    </div>
                  </Link>
                ))}
                {upcomingDates.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{upcomingDates.length - 5} more events
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
