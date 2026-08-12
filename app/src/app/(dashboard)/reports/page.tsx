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
        <MoodTrendsReport />

        <ImportantDatesReport />

        <ActivitySummaryReport />

        <GiftsLoansReport />
      </div>
    </div>
  );
}
