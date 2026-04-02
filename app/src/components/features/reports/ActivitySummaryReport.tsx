"use client";

import { useEffect, useState } from "react";
import { BarChart, Users } from "lucide-react";
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
import { getActivityStats } from "@/lib/actions/report-stats";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ActivityStats {
  totalActivities: number;
  totalNotes: number;
  totalCalls: number;
  byMonth: {
    name: string;
    activities: number;
    notes: number;
    calls: number;
  }[];
}

export function ActivitySummaryReport() {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30");

  useEffect(() => {
    fetchStats();
  }, [timeframe]);

  const fetchStats = async () => {
    setLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(timeframe, 10));

    const result = await getActivityStats({ startDate, endDate });
    setStats(result);
    setLoading(false);
  };

  const totalItems =
    (stats?.totalActivities ?? 0) + (stats?.totalNotes ?? 0) + (stats?.totalCalls ?? 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Activity Summary</CardTitle>
          <CardDescription>Interactions and records across your vault.</CardDescription>
        </div>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        </div>

        {!loading && stats && (
          <div className="space-y-4">
            {totalItems > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <p>Activities: {stats.totalActivities}</p>
                  <p>Notes: {stats.totalNotes}</p>
                  <p>Calls: {stats.totalCalls}</p>
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={stats.byMonth}>
                      <XAxis
                        dataKey="name"
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
                      <Bar dataKey="activities" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="notes" fill="hsl(var(--secondary-foreground))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="calls" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <BarChart className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No activity data for this period.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
