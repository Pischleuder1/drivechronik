import { useTranslations } from "next-intl";
import { Cpu } from "lucide-react";
import { formatDuration } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../lib/config";
import type { SoftwareUpdateRow } from "../../../lib/softwareUpdates";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

function formatInstalledPeriod(
  update: SoftwareUpdateRow,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const start = dateFormatter.format(update.startTime);

  if (update.endTime == null) {
    return t("software.since", { date: start });
  }

  const end = dateFormatter.format(update.endTime);

  return start === end
    ? start
    : t("software.range", { start, end });
}

function installDuration(
  update: SoftwareUpdateRow,
  t: (key: string, values?: Record<string, string>) => string,
): string | null {
  if (update.endTime == null) return null;

  const seconds =
    (update.endTime.getTime() - update.startTime.getTime()) /
    1000;

  if (seconds <= 0) return null;

  return t("software.installDuration", {
    duration: formatDuration(seconds),
  });
}

export function SoftwareTimeline({
  updates,
  embedded = false,
  compact = false,
}: {
  updates: SoftwareUpdateRow[];
  embedded?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("settings");

  const sectionClass = embedded
    ? "mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800"
    : "mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";

  if (updates.length === 0) {
    return (
      <section className={sectionClass}>
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Cpu aria-hidden size={16} />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("software.title")}
          </h2>
        </div>

        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t("software.empty")}
        </p>
      </section>
    );
  }

  const currentId = updates[0]!.id;

  if (compact) {
    const current = updates[0]!;
    const previous = updates.slice(1);

    return (
      <section className={sectionClass}>
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Cpu aria-hidden size={16} />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("software.title")}
          </h2>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {current.version ??
                t("software.unknownVersion")}
            </span>

            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {t("software.current")}
            </span>
          </div>

          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatInstalledPeriod(current, t)}
          </span>
        </div>

        {previous.length > 0 && (
          <ol className="mt-2 grid gap-x-6 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {previous.map((update) => {
              const duration = installDuration(update, t);

              return (
                <li
                  key={update.id}
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm dark:border-neutral-800"
                >
                  <span className="shrink-0 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {update.version ??
                      t("software.unknownVersion")}
                  </span>

                  <span className="truncate text-right text-xs text-neutral-500 dark:text-neutral-400">
                    {formatInstalledPeriod(update, t)}
                    {duration ? ` · ${duration}` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <Cpu aria-hidden size={16} />
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {t("software.title")}
        </h2>
      </div>

      <ol className="mt-4">
        {updates.map((update, idx) => {
          const isCurrent = update.id === currentId;
          const isLast = idx === updates.length - 1;
          const duration = installDuration(update, t);

          return (
            <li
              key={update.id}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-3 h-full w-px bg-neutral-200 dark:bg-neutral-700"
                />
              )}

              <span
                aria-hidden
                className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${
                  isCurrent
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {update.version ??
                      t("software.unknownVersion")}
                  </span>

                  {isCurrent && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {t("software.current")}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatInstalledPeriod(update, t)}
                  {duration ? ` · ${duration}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
