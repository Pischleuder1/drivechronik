"use client";

import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CarFront,
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "../../../../components/ui/Button";

type ReportScope = "business" | "private" | "all";

const ALL_CLASSIFICATIONS =
  "business,private,commute,unclassified";

function classificationForScope(scope: ReportScope): string {
  if (scope === "business") return "business";
  if (scope === "private") return "private";
  return ALL_CLASSIFICATIONS;
}

export function YearReportFilters({
  year,
  scope,
}: {
  year: string;
  scope: ReportScope;
}) {
  const router = useRouter();
  const t = useTranslations("reports");
  const numericYear = Number(year);

  function goTo(
    nextYear: number,
    nextScope: ReportScope = scope,
  ) {
    router.push(
      `/reports/year?year=${nextYear}&classification=${classificationForScope(nextScope)}`,
      { scroll: false },
    );
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
      <div className="grid w-full grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1 md:flex md:w-auto">
        <button
          type="button"
          aria-label={t("year.prevYear")}
          onClick={() => goTo(numericYear - 1)}
          className={buttonClasses(
            "secondary",
            "md",
            "!h-9 !w-9 !p-0",
          )}
        >
          <ChevronLeft aria-hidden size={18} />
        </button>

        <input
          type="number"
          min={2000}
          max={2100}
          step={1}
          value={year}
          aria-label={t("year.selectYear")}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (
              Number.isInteger(value) &&
              value >= 2000 &&
              value <= 2100
            ) {
              goTo(value);
            }
          }}
          className="w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-center text-sm tabular-nums text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:w-28 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-neutral-950"
        />

        <button
          type="button"
          aria-label={t("year.nextYear")}
          onClick={() => goTo(numericYear + 1)}
          className={buttonClasses(
            "secondary",
            "md",
            "!h-9 !w-9 !p-0",
          )}
        >
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>

      <div className="grid w-full grid-cols-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-1 md:inline-flex md:w-auto md:rounded-xl dark:border-neutral-700 dark:bg-neutral-950">
        <button
          type="button"
          aria-pressed={scope === "business"}
          onClick={() => goTo(numericYear, "business")}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            scope === "business"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <BriefcaseBusiness aria-hidden size={15} className="hidden md:block" />
          {t("filters.businessOnly")}
        </button>

        <button
          type="button"
          aria-pressed={scope === "private"}
          onClick={() => goTo(numericYear, "private")}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            scope === "private"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <CarFront aria-hidden size={15} className="hidden md:block" />
          {t("filters.privateOnly")}
        </button>

        <button
          type="button"
          aria-pressed={scope === "all"}
          onClick={() => goTo(numericYear, "all")}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium transition md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
            scope === "all"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <List aria-hidden size={15} className="hidden md:block" />
          {t("filters.allDrives")}
        </button>
      </div>
    </div>
  );
}
