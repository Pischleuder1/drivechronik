"use client";

import { useEffect, useRef, useState } from "react";
import type { YearlyMonthSummary } from "../../../../lib/yearlyInsightsTypes";

type Labels = {
  total: string;
  drives: string;
  close: string;
  business: string;
  private: string;
  commute: string;
  unclassified: string;
};

function monthDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function shortMonth(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(monthDate(monthKey));
}

function longMonth(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate(monthKey));
}

function formatKm(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} km`;
}

export function YearlyMonthlyCategoryChart({
  months,
  locale,
  labels,
}: {
  months: YearlyMonthSummary[];
  locale: string;
  labels: Labels;
}) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const maxMonthKm = Math.max(0, ...months.map((month) => month.distanceKm));

  const selectedMonth =
    months.find((month) => month.monthKey === selectedMonthKey) ?? null;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setSelectedMonthKey(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative mt-4">
      {selectedMonth && (
        <div
          id="yearly-month-popup"
          className="absolute left-1/2 top-2 z-30 w-[min(290px,calc(100%-16px))] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-3 text-[13px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                {longMonth(selectedMonth.monthKey, locale)}
              </div>

              <div className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                {labels.total}:{" "}
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {formatKm(selectedMonth.distanceKm, locale)}
                </span>
              </div>
            </div>

            <button
              type="button"
              aria-label={labels.close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              onClick={() => setSelectedMonthKey(null)}
            >
              ×
            </button>
          </div>

          <div className="mt-3 grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-400" />
                {labels.business}
              </span>
              <span className="font-medium tabular-nums">
                {formatKm(selectedMonth.businessDistanceKm, locale)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
                {labels.private}
              </span>
              <span className="font-medium tabular-nums">
                {formatKm(selectedMonth.privateDistanceKm, locale)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 dark:bg-amber-400" />
                {labels.commute}
              </span>
              <span className="font-medium tabular-nums">
                {formatKm(selectedMonth.commuteDistanceKm, locale)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-neutral-400 dark:bg-neutral-500" />
                {labels.unclassified}
              </span>
              <span className="font-medium tabular-nums">
                {formatKm(selectedMonth.unclassifiedDistanceKm, locale)}
              </span>
            </div>
          </div>

          <div className="mt-2 border-t border-neutral-100 pt-2 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {selectedMonth.driveCount} {labels.drives}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        {months.map((month) => {
          const height =
            maxMonthKm > 0
              ? Math.max(
                  4,
                  Math.round((month.distanceKm / maxMonthKm) * 100),
                )
              : 4;

          const percentage = (distanceKm: number): number =>
            month.distanceKm > 0
              ? (distanceKm / month.distanceKm) * 100
              : 0;

          const selected = selectedMonthKey === month.monthKey;

          const tooltip = [
            `${longMonth(month.monthKey, locale)}: ${formatKm(
              month.distanceKm,
              locale,
            )}`,
            `${labels.business}: ${formatKm(
              month.businessDistanceKm,
              locale,
            )}`,
            `${labels.private}: ${formatKm(
              month.privateDistanceKm,
              locale,
            )}`,
            `${labels.commute}: ${formatKm(
              month.commuteDistanceKm,
              locale,
            )}`,
            `${labels.unclassified}: ${formatKm(
              month.unclassifiedDistanceKm,
              locale,
            )}`,
          ].join(" · ");

          return (
            <button
              key={month.monthKey}
              type="button"
              title={tooltip}
              aria-expanded={selected}
              aria-controls={selected ? "yearly-month-popup" : undefined}
              aria-label={`${longMonth(month.monthKey, locale)}: ${formatKm(
                month.distanceKm,
                locale,
              )}`}
              onClick={() =>
                setSelectedMonthKey((current) =>
                  current === month.monthKey ? null : month.monthKey,
                )
              }
              className="flex min-w-0 flex-col items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex h-36 w-full items-end justify-center">
                <div
                  className={`flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t bg-neutral-100 transition ${
                    selected
                      ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-neutral-900"
                      : ""
                  } dark:bg-neutral-800`}
                  style={{ height: `${height}%` }}
                >
                  {month.businessDistanceKm > 0 && (
                    <div
                      className="w-full shrink-0 bg-blue-600 dark:bg-blue-400"
                      style={{
                        height: `${percentage(
                          month.businessDistanceKm,
                        )}%`,
                      }}
                    />
                  )}

                  {month.privateDistanceKm > 0 && (
                    <div
                      className="w-full shrink-0 bg-emerald-600 dark:bg-emerald-400"
                      style={{
                        height: `${percentage(
                          month.privateDistanceKm,
                        )}%`,
                      }}
                    />
                  )}

                  {month.commuteDistanceKm > 0 && (
                    <div
                      className="w-full shrink-0 bg-amber-500 dark:bg-amber-400"
                      style={{
                        height: `${percentage(
                          month.commuteDistanceKm,
                        )}%`,
                      }}
                    />
                  )}

                  {month.unclassifiedDistanceKm > 0 && (
                    <div
                      className="w-full shrink-0 bg-neutral-400 dark:bg-neutral-500"
                      style={{
                        height: `${percentage(
                          month.unclassifiedDistanceKm,
                        )}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              <span className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                {shortMonth(month.monthKey, locale)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
