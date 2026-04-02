"use client";

import { useEffect, useState } from "react";
import { CalendarDays, BarChart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getImportantDatesStats } from "@/lib/actions/report-stats";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ImportantDatesStats {
  totalDates: number;
  byType: { label: string; count: number }[];
  upcoming: {
    contactName: string;
    label: string;
    daysUntil: number;
    month: number;
    day: number;
  }[];
}

export function ImportantDatesReport() {
  const [stats, setStats] = useState<ImportantDatesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("90");

  useEffect(() => {
    fetchStats();
  }, [timeframe]);

  const fetchStats = async () => {
    setLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(timeframe, 10));

    const result = await getImportantDatesStats({ startDate, endDate });
    setStats(result);
    setLoading(false);
  };

  const hasAnyData = (stats?.totalDates ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Important Dates Overview</CardTitle>
          <CardDescription>Track key dates and what is coming up next.</CardDescription>
        </div>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Next 30 days</SelectItem>
              <SelectItem value="90">Next 90 days</SelectItem>
              <SelectItem value="180">Next 180 days</SelectItem>
              <SelectItem value="365">Next year</SelectItem>
            </SelectContent>
          </Select>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        </div>

        {!loading && stats && (
          <div className="space-y-4">
            {hasAnyData ? (
              <>
                <p className="text-sm text-muted-foreground">Total dates: {stats.totalDates}</p>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={stats.byType}>
                      <XAxis
                        dataKey="label"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Upcoming Dates</p>
                  {stats.upcoming.length > 0 ? (
                    <div className="space-y-1">
                      {stats.upcoming.slice(0, 5).map((item) => (
                        <div
                          key={`${item.contactName}-${item.label}-${item.month}-${item.day}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate pr-3">
                            {item.contactName} - {item.label}
                          </span>
                          <span className="text-muted-foreground">
                            {item.daysUntil === 0 ? "Today" : `in ${item.daysUntil} days`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming dates in this timeframe.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <BarChart className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No important dates recorded.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
