import Link from "next/link";
import { BarChart3, CalendarRange, Route } from "lucide-react";

export function InsightsViewTabs({
  active,
  analysisLabel,
  routeHeatmapLabel,
  yearlyLabel,
}: {
  active: "analysis" | "routes" | "yearly";
  analysisLabel: string;
  routeHeatmapLabel: string;
  yearlyLabel: string;
}) {
  return (
    <div className="mt-4">
      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-950">
        <Link
          href="/insights?view=analysis"
          aria-current={active === "analysis" ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === "analysis"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <BarChart3 aria-hidden size={15} />
          {analysisLabel}
        </Link>

        <Link
          href="/insights?view=routes"
          aria-current={active === "routes" ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === "routes"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <Route aria-hidden size={15} />
          {routeHeatmapLabel}
        </Link>

        <Link
          href="/insights?view=yearly"
          aria-current={active === "yearly" ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === "yearly"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <CalendarRange aria-hidden size={15} />
          {yearlyLabel}
        </Link>
      </div>
    </div>
  );
}
