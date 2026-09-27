"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { Classification } from "@drivechronik/core";

const CLASSIFICATION_VALUES: Classification[] = [
  "business",
  "private",
  "commute",
  "unclassified",
];

const TYPE_VALUES: Array<"drives" | "charges" | "all"> = ["drives", "charges", "all"];

export function SearchControls({
  q,
  from,
  to,
  classifications,
  type,
}: {
  q: string;
  from: string;
  to: string;
  classifications: Classification[];
  type: "drives" | "charges" | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const [qInput, setQInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync if the URL changes from elsewhere (e.g. back/forward nav).
  useEffect(() => {
    setQInput(q);
  }, [q]);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`/search?${params.toString()}`);
  }

  function onQChange(value: string) {
    setQInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value });
    }, 400);
  }

  function toggleClassification(value: Classification) {
    const isSelected = classifications.includes(value);
    const next = isSelected
      ? classifications.filter((c) => c !== value)
      : [...classifications, value];
    pushParams({ classification: next.length > 0 ? next.join(",") : null });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 md:hidden"
        />

        <input
          type="search"
          autoFocus
          value={qInput}
          onChange={(e) => onQChange(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          className="h-12 w-full rounded-[16px] border border-neutral-300 bg-white pl-9 pr-3 text-[15px] text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 md:h-auto md:rounded-2xl md:px-4 md:py-3 md:text-base dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-800"
        />
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-3">
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
          <div className="min-w-0 md:contents">
            <label
              htmlFor="search-from"
              className="mb-1 block text-[11px] font-medium text-neutral-500 md:mb-0 md:text-xs dark:text-neutral-400"
            >
              {t("from")}
            </label>

            <input
              id="search-from"
              type="date"
              value={from}
              onChange={(e) => pushParams({ from: e.target.value })}
              className="h-10 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-2 text-[13px] text-neutral-900 shadow-sm md:h-auto md:w-auto md:px-2.5 md:py-1.5 md:text-base dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="min-w-0 md:contents">
            <label
              htmlFor="search-to"
              className="mb-1 block text-[11px] font-medium text-neutral-500 md:mb-0 md:text-xs dark:text-neutral-400"
            >
              {t("to")}
            </label>

            <input
              id="search-to"
              type="date"
              value={to}
              onChange={(e) => pushParams({ to: e.target.value })}
              className="h-10 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-2 text-[13px] text-neutral-900 shadow-sm md:h-auto md:w-auto md:px-2.5 md:py-1.5 md:text-base dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CLASSIFICATION_VALUES.map((value) => {
            const active = classifications.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleClassification(value)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition md:px-3 md:text-xs ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {tc(`classification.${value}`)}
              </button>
            );
          })}
        </div>

        <div className="flex w-fit items-center gap-0.5 rounded-xl border border-neutral-300 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-800/50">
          {TYPE_VALUES.map((value) => {
            const active = type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pushParams({ type: value === "drives" ? null : value })}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition md:text-xs ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {t(`type.${value}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
