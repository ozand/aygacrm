import { CalendarView } from "@/components/features/calendar-view";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          View all your important dates, reminders, tasks, and activities
        </p>
      </div>

      <CalendarView />
    </div>
  );
}
