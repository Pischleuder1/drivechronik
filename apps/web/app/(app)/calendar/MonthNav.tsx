"use client";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "../../../lib/calendarGrid";
import { toIntlLocale } from "../../../lib/i18nLocale";
import { buttonClasses } from "../../../components/ui/Button";

interface Props {
  month: string; // YYYY-MM
  currentMonth: string;
  compact?: boolean;
}

export function MonthNav({
  month,
  currentMonth,
  compact = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const locale = useLocale();

  function goTo(nextMonth: string) {
    router.push(`/calendar?month=${nextMonth}`);
  }

  if (compact) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          <button
            type="button"
            aria-label={t("prevMonth")}
            onClick={() => goTo(shiftMonth(month, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1.5">
            <span className="truncate text-center text-[17px] font-semibold capitalize tracking-tight text-neutral-950">
              {formatMonthLabelClient(month, locale)}
            </span>

            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100">
              <CalendarDays
                aria-hidden
                size={18}
              />

              <input
                type="month"
                value={month}
                aria-label={t("monthSelectLabel")}
                onChange={(e) => {
                  if (e.target.value) goTo(e.target.value);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
          </div>

          <button
            type="button"
            aria-label={t("nextMonth")}
            onClick={() => goTo(shiftMonth(month, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm"
          >
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>

        {month !== currentMonth && (
          <div className="mt-2 flex justify-center border-t border-neutral-100 pt-2">
            <button
              type="button"
              onClick={() => goTo(currentMonth)}
              className="h-8 rounded-xl border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-700 shadow-sm"
            >
              {t("today")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={() => goTo(shiftMonth(month, -1))}
          className={buttonClasses("secondary", "md", "!h-9 !w-9 !p-0")}
        >
          <ChevronLeft aria-hidden size={18} />
        </button>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => goTo(shiftMonth(month, 1))}
          className={buttonClasses("secondary", "md", "!h-9 !w-9 !p-0")}
        >
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>

      <div className="min-w-0 text-xl font-semibold capitalize tracking-tight md:text-2xl">
        {formatMonthLabelClient(month, locale)}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {month !== currentMonth && (
          <button
            type="button"
            onClick={() => goTo(currentMonth)}
            className={buttonClasses("secondary", "md")}
          >
            {t("today")}
          </button>
        )}
        <input
          type="month"
          value={month}
          aria-label={t("monthSelectLabel")}
          onChange={(e) => {
            if (e.target.value) goTo(e.target.value);
          }}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
        />
      </div>
    </div>
  );
}

function formatMonthLabelClient(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, 1, 12));
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}
