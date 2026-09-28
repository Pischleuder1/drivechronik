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
    <div className="relative z-10 -mt-5 md:mt-4">
      <div className="grid w-full grid-cols-3 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm md:inline-flex md:w-auto md:rounded-xl md:bg-neutral-50 md:shadow-none dark:border-neutral-700 dark:bg-neutral-950">
        <Link
          href="/insights?view=analysis"
          aria-current={active === "analysis" ? "page" : undefined}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            active === "analysis"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <BarChart3 aria-hidden size={15} className="hidden md:block" />
          {analysisLabel}
        </Link>

        <Link
          href="/insights?view=routes"
          aria-current={active === "routes" ? "page" : undefined}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            active === "routes"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <Route aria-hidden size={15} className="hidden md:block" />
          {routeHeatmapLabel}
        </Link>

        <Link
          href="/insights?view=yearly"
          aria-current={active === "yearly" ? "page" : undefined}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            active === "yearly"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <CalendarRange aria-hidden size={15} className="hidden md:block" />
          {yearlyLabel}
        </Link>
      </div>
    </div>
  );
}
