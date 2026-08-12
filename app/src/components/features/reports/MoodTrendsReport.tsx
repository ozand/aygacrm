"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMoodStats } from "@/lib/actions/mood-tracking";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Smile } from "lucide-react";
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";

interface MoodTrendsReportProps {
  // Can pass an optional contactId to filter by a specific contact
  contactId?: string;
}

export function MoodTrendsReport({ contactId }: MoodTrendsReportProps) {
  const [moodStats, setMoodStats] = useState<{
    totalEvents: number;
    averageSleep: number | null;
    byParameter: { label: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("30"); // default to last 30 days

  useEffect(() => {
    fetchMoodStats();
  }, [contactId, timeframe]);

  const fetchMoodStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(timeframe));

      const stats = await getMoodStats(contactId || "all", { // Need to handle "all" contacts in getMoodStats
        startDate,
        endDate,
      });
      setMoodStats(stats);
    } catch {
      setError("Couldn't load mood data.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = moodStats?.byParameter.map((param) => ({
    name: param.label,
    count: param.count,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Mood Trends</CardTitle>
          <CardDescription>
            Analysis of mood entries over time.
          </CardDescription>
        </div>
        <Smile className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
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

        {!loading && error && (
          <p className="text-sm text-muted-foreground">Couldn't load mood data.</p>
        )}

        {!loading && !error && (!moodStats || moodStats.byParameter.length === 0) && (
          <p className="text-sm text-muted-foreground">No mood entries yet.</p>
        )}

        {!loading && !error && moodStats && moodStats.byParameter.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>Total mood entries: {moodStats.totalEvents}</p>
              {moodStats.averageSleep !== null && (
                <p>Average sleep: {moodStats.averageSleep.toFixed(1)} hrs</p>
              )}
            </div>

            {chartData && chartData.length > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={chartData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <BarChart className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No mood data for this period.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
