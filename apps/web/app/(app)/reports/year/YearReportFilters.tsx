"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonClasses } from "../../../../components/ui/Button";

export function YearReportFilters({
  year,
}: {
  year: string;
}) {
  const router = useRouter();
  const t = useTranslations("reports");

  function goTo(nextYear: number) {
    router.push(`/reports/year?year=${nextYear}`);
  }

  const numericYear = Number(year);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t("year.prevYear")}
        onClick={() => goTo(numericYear - 1)}
        className={buttonClasses("secondary", "md", "!h-9 !w-9 !p-0")}
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
          if (Number.isInteger(value) && value >= 2000 && value <= 2100) {
            goTo(value);
          }
        }}
        className="w-28 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-center text-sm tabular-nums text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
      />

      <button
        type="button"
        aria-label={t("year.nextYear")}
        onClick={() => goTo(numericYear + 1)}
        className={buttonClasses("secondary", "md", "!h-9 !w-9 !p-0")}
      >
        <ChevronRight aria-hidden size={18} />
      </button>
    </div>
  );
}
