"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { buttonClasses } from "../../../../components/ui/Button";

interface Props {
  date: string; // YYYY-MM-DD
  longLabel: string;
  prevDate: string;
  nextDate: string;
  today: string;
  exportCsvHref?: string;
  exportPdfHref?: string;
}

const arrowClasses = buttonClasses(
  "secondary",
  "md",
  "!h-9 !w-9 !p-0 text-base",
);

export function DateNav({
  date,
  longLabel,
  prevDate,
  nextDate,
  today,
  exportCsvHref,
  exportPdfHref,
}: Props) {
  const router = useRouter();
  const t = useTranslations("day");
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <>
      <div className="rounded-[20px] border border-neutral-200 bg-white p-3 shadow-sm md:hidden">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          <Link
            href={`/day/${prevDate}`}
            aria-label={t("prevDay")}
            className={arrowClasses}
          >
            <ChevronLeft aria-hidden size={18} />
          </Link>

          <div className="min-w-0 text-center text-[15px] font-semibold leading-snug text-neutral-950">
            {longLabel}
          </div>

          <Link
            href={`/day/${nextDate}`}
            aria-label={t("nextDay")}
            className={arrowClasses}
          >
            <ChevronRight aria-hidden size={18} />
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 border-t border-neutral-100 pt-3">
          {date !== today && (
            <Link
              href={`/day/${today}`}
              className={buttonClasses("secondary", "sm")}
            >
              {t("today")}
            </Link>
          )}

          <input
            type="date"
            value={date}
            aria-label={t("dateSelectLabel")}
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/day/${v}`);
            }}
            className="min-w-0 w-[148px] rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />

          <Link
            href={`/calendar?month=${date.slice(0, 7)}`}
            aria-label={t("openCalendar")}
            title={t("openCalendar")}
            className={buttonClasses("ghost", "sm", "!h-8 !w-8 !p-0")}
          >
            <CalendarRange aria-hidden size={17} />
          </Link>

          {exportCsvHref && exportPdfHref && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={exportOpen}
                aria-label={t("export")}
                onClick={() => setExportOpen((open) => !open)}
                className={buttonClasses(
                  "ghost",
                  "sm",
                  "!h-8 gap-1.5 !px-2 text-xs",
                )}
              >
                <Download aria-hidden size={15} />
                {t("export")}
              </button>

              {exportOpen && (
                <div className="absolute right-0 top-full z-[1000] mt-2 w-28 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
                  <a
                    href={exportCsvHref}
                    onClick={() => setExportOpen(false)}
                    className="block rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    CSV
                  </a>

                  <a
                    href={exportPdfHref}
                    onClick={() => setExportOpen(false)}
                    className="block rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    PDF
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:flex dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-1">
          <Link
            href={`/day/${prevDate}`}
            aria-label={t("prevDay")}
            className={arrowClasses}
          >
            <ChevronLeft aria-hidden size={18} />
          </Link>

          <Link
            href={`/day/${nextDate}`}
            aria-label={t("nextDay")}
            className={arrowClasses}
          >
            <ChevronRight aria-hidden size={18} />
          </Link>
        </div>

        <div className="min-w-0 text-xl font-semibold tracking-tight md:text-2xl">
          {longLabel}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {date !== today && (
            <Link href={`/day/${today}`} className={buttonClasses("secondary", "md")}>
              {t("today")}
            </Link>
          )}

          <input
            type="date"
            value={date}
            aria-label={t("dateSelectLabel")}
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/day/${v}`);
            }}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
          />

          <Link
            href={`/calendar?month=${date.slice(0, 7)}`}
            aria-label={t("openCalendar")}
            title={t("openCalendar")}
            className={buttonClasses("ghost", "md", "!h-9 !w-9 !p-0")}
          >
            <CalendarRange aria-hidden size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}
