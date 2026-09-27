"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { VehicleUsagePeriod } from "../../../lib/vehicleUsage";

interface Props {
  period: VehicleUsagePeriod;
  value: string | null;
  currentDay: string;
  currentMonth: string;
  currentYear: string;
  labels: {
    day: string;
    month: string;
    year: string;
    all: string;
    previous: string;
    next: string;
  };
}

function shiftValue(
  period: VehicleUsagePeriod,
  value: string,
  amount: number,
): string {
  if (period === "year") {
    return String(Number(value) + amount);
  }

  if (period === "month") {
    const [year, month] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1 + amount, 1));

    return `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + amount));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function VehicleUsageFilter({
  period,
  value,
  currentDay,
  currentMonth,
  currentYear,
  labels,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(
    nextPeriod: VehicleUsagePeriod,
    nextValue: string | null,
  ) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("period", nextPeriod);

    if (nextPeriod === "all" || nextValue == null) {
      params.delete("value");
    } else {
      params.set("value", nextValue);
    }

    router.push(`/vehicle?${params.toString()}`, {
      scroll: false,
    });
  }

  function selectPeriod(nextPeriod: VehicleUsagePeriod) {
    if (nextPeriod === "all") {
      navigate(nextPeriod, null);
      return;
    }

    const nextValue =
      nextPeriod === "day"
        ? currentDay
        : nextPeriod === "month"
          ? currentMonth
          : currentYear;

    navigate(nextPeriod, nextValue);
  }

  const periods: Array<{
    key: VehicleUsagePeriod;
    label: string;
  }> = [
    { key: "day", label: labels.day },
    { key: "month", label: labels.month },
    { key: "year", label: labels.year },
    { key: "all", label: labels.all },
  ];

  return (
    <div className="mt-3 rounded-[16px] bg-neutral-50 p-2.5 md:mt-4 md:rounded-2xl md:p-3 dark:bg-neutral-800/60">
      <div className="flex flex-col gap-2.5 md:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full grid-cols-4 rounded-xl bg-neutral-200/70 p-1 md:inline-flex md:w-fit dark:bg-neutral-900">
          {periods.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => selectPeriod(item.key)}
              className={`rounded-lg px-2 py-1.5 text-[12px] font-semibold transition md:px-4 md:py-2 md:text-sm ${
                period === item.key
                  ? "bg-violet-600 text-white shadow-sm dark:bg-violet-500"
                  : "text-neutral-600 hover:bg-white/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period !== "all" && value && (
          <div className="flex w-full items-center gap-2 md:w-fit">
            <button
              type="button"
              aria-label={labels.previous}
              onClick={() =>
                navigate(period, shiftValue(period, value, -1))
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-100 md:h-11 md:w-11 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <ChevronLeft aria-hidden size={19} />
            </button>

            {period === "day" && (
              <input
                type="date"
                value={value}
                onChange={(event) =>
                  navigate(period, event.target.value)
                }
                className="h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-2 text-center text-[13px] font-semibold text-neutral-900 shadow-sm md:h-11 md:min-w-[190px] md:flex-none md:px-4 md:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            )}

            {period === "month" && (
              <input
                type="month"
                value={value}
                onChange={(event) =>
                  navigate(period, event.target.value)
                }
                className="h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-2 text-center text-[13px] font-semibold text-neutral-900 shadow-sm md:h-11 md:min-w-[190px] md:flex-none md:px-4 md:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            )}

            {period === "year" && (
              <input
                type="number"
                min="2000"
                max="2100"
                step="1"
                value={value}
                onChange={(event) =>
                  navigate(period, event.target.value)
                }
                className="h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-2 text-center text-[13px] font-semibold text-neutral-900 shadow-sm md:h-11 md:w-32 md:flex-none md:px-4 md:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            )}

            <button
              type="button"
              aria-label={labels.next}
              onClick={() =>
                navigate(period, shiftValue(period, value, 1))
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-100 md:h-11 md:w-11 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <ChevronRight aria-hidden size={19} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
