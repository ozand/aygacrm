import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { MoodTrendsReport } from "@/components/features/reports/MoodTrendsReport";
import { ImportantDatesReport } from "@/components/features/reports/ImportantDatesReport";
import { ActivitySummaryReport } from "@/components/features/reports/ActivitySummaryReport";
import { GiftsLoansReport } from "@/components/features/reports/GiftsLoansReport";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Reports
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        Dive deep into your contacts data with various reports and insights.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Geographical Distribution
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">
              Visualize contacts on a map.
            </p>
          </CardContent>
        </Card>

        <MoodTrendsReport />

        <ImportantDatesReport />

        <ActivitySummaryReport />

        <GiftsLoansReport />
      </div>
    </div>
  );
}
