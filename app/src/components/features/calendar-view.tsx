"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays as addDayUtil,
  subDays as subDayUtil,
} from "date-fns";
import { getCalendarEvents, type CalendarEvent } from "@/lib/actions/calendar";
import Link from "next/link";

const eventTypeLabels: Record<CalendarEvent["type"], string> = {
  important_date: "Important Date",
  task: "Task",
  activity: "Activity",
  life_event: "Life Event",
  call: "Call",
};

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getCalendarEvents(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
      setEvents(data);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  }

  function goToPreviousMonth() {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Group events by date
  function getEventsForDate(date: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(new Date(e.date), date));
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const today = new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Calendar Grid */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
              <div
                key={weekday}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {weekday}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((dayDate, index) => {
              const dayEvents = getEventsForDate(dayDate);
              const isCurrentMonth = isSameMonth(dayDate, currentDate);
              const isToday = isSameDay(dayDate, today);
              const isSelected = selectedDate && isSameDay(dayDate, selectedDate);

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(dayDate)}
                  className={`
                    min-h-[100px] p-1 text-left border rounded-md transition-colors relative
                    ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                    ${isToday ? "border-primary" : "border-border"}
                    ${isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}
                  `}
                >
                  <div
                    className={`
                      text-sm font-medium mb-1 absolute top-1 right-1
                      ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : ""}
                    `}
                  >
                    {format(dayDate, "d")}
                  </div>
                  <div className="space-y-0.5 mt-6">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs truncate px-1 py-0.5 rounded"
                        style={{ backgroundColor: event.color + "20", color: event.color }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            <CardTitle>
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a day"}
            </CardTitle>
          </div>
          {selectedDate && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDayUtil(selectedDate, 1))} aria-label="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDayUtil(selectedDate, 1))} aria-label="Next day">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-muted-foreground text-sm">
              Click on a day in the calendar to see its events.
            </p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events on this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-3 border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{event.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(event.date), "h:mm a")}</span>
                      </div>
                      {event.contactName && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{event.contactName}</span>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: event.color + "20",
                        color: event.color,
                      }}
                    >
                      {eventTypeLabels[event.type]}
                    </Badge>
                  </div>
                  {event.url && (
                    <Link
                      href={event.url}
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      View contact
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
