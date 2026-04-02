"use client";

import { useEffect, useState } from "react";
import { BarChart, DollarSign } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGiftsLoansStats } from "@/lib/actions/report-stats";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface GiftsLoansStats {
  gifts: {
    byStatus: { status: string; count: number; totalAmount: number }[];
    total: number;
  };
  loans: {
    total: number;
    settled: number;
    outstanding: number;
    outstandingAmount: number;
  };
}

function formatStatus(status: string) {
  if (status === "idea") return "Idea";
  if (status === "planned") return "Planned";
  if (status === "given") return "Given";
  if (status === "received") return "Received";
  return status;
}

export function GiftsLoansReport() {
  const [stats, setStats] = useState<GiftsLoansStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const result = await getGiftsLoansStats();
    setStats(result);
    setLoading(false);
  };

  const hasData = (stats?.gifts.total ?? 0) > 0 || (stats?.loans.total ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Gifts &amp; Loans</CardTitle>
          <CardDescription>All-time financial exchange overview.</CardDescription>
        </div>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading && <p className="mb-4 text-sm text-muted-foreground">Loading...</p>}

        {!loading && stats && (
          <div className="space-y-4">
            {hasData ? (
              <>
                <p className="text-sm text-muted-foreground">Total gifts: {stats.gifts.total}</p>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={stats.gifts.byStatus.map((item) => ({
                        ...item,
                        name: formatStatus(item.status),
                      }))}
                    >
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
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Total loans: {stats.loans.total}</p>
                  <p>Settled loans: {stats.loans.settled}</p>
                  <p>Outstanding loans: {stats.loans.outstanding}</p>
                  <p>Outstanding amount: {stats.loans.outstandingAmount.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <BarChart className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No gifts or loans recorded.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
