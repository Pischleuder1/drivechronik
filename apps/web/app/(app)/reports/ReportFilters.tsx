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
import type { Classification } from "@drivechronik/core";
import { buttonClasses } from "../../../components/ui/Button";

const BUSINESS_ONLY: Classification[] = ["business"];
const PRIVATE_ONLY: Classification[] = ["private"];

const ALL_DRIVES: Classification[] = [
  "business",
  "private",
  "commute",
  "unclassified",
];

function buildQuery(month: string, classifications: Classification[]): string {
  const params = new URLSearchParams({ month });
  params.set("classification", classifications.join(","));
  return `?${params.toString()}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) + delta;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

export function ReportFilters({
  month,
  selected,
}: {
  month: string;
  selected: Classification[];
}) {
  const router = useRouter();
  const t = useTranslations("reports");

  const businessOnly =
    selected.length === 1 && selected[0] === "business";

  const privateOnly =
    selected.length === 1 && selected[0] === "private";

  const allDrives = !businessOnly && !privateOnly;

  const effectiveSelected = businessOnly
    ? BUSINESS_ONLY
    : privateOnly
      ? PRIVATE_ONLY
      : ALL_DRIVES;

  function goTo(
    nextMonth: string,
    nextSelected: Classification[],
  ) {
    router.push(`/reports${buildQuery(nextMonth, nextSelected)}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-950">
        <button
          type="button"
          aria-pressed={businessOnly}
          onClick={() => goTo(month, BUSINESS_ONLY)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            businessOnly
              ? "bg-blue-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <BriefcaseBusiness aria-hidden size={15} />
          {t("filters.businessOnly")}
        </button>

        <button
          type="button"
          aria-pressed={privateOnly}
          onClick={() => goTo(month, PRIVATE_ONLY)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            privateOnly
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <CarFront aria-hidden size={15} />
          {t("filters.privateOnly")}
        </button>

        <button
          type="button"
          aria-pressed={allDrives}
          onClick={() => goTo(month, ALL_DRIVES)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            allDrives
              ? "bg-violet-600 text-white shadow-sm"
              : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          }`}
        >
          <List aria-hidden size={15} />
          {t("filters.allDrives")}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("filters.prevMonth")}
          onClick={() => goTo(shiftMonth(month, -1), effectiveSelected)}
          className={buttonClasses(
            "secondary",
            "md",
            "!h-9 !w-9 !p-0",
          )}
        >
          <ChevronLeft aria-hidden size={18} />
        </button>

        <input
          type="month"
          value={month}
          aria-label={t("filters.selectMonth")}
          onChange={(e) => {
            if (e.target.value) {
              goTo(e.target.value, effectiveSelected);
            }
          }}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
        />

        <button
          type="button"
          aria-label={t("filters.nextMonth")}
          onClick={() => goTo(shiftMonth(month, 1), effectiveSelected)}
          className={buttonClasses(
            "secondary",
            "md",
            "!h-9 !w-9 !p-0",
          )}
        >
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>
    </div>
  );
}
