import type { ReactNode } from "react";

type SectionTone =
  | "blue"
  | "sky"
  | "indigo"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "neutral";

const accentClasses: Record<SectionTone, string> = {
  blue: "bg-blue-500",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  neutral: "bg-neutral-400",
};

export function SectionHeader({
  title,
  subtitle,
  count,
  actions,
  tone = "blue",
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <div
      className={`flex items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800 ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 h-5 w-1 shrink-0 rounded-full ${accentClasses[tone]}`}
        />

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {count != null && (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {count}
          </span>
        )}

        {actions}
      </div>
    </div>
  );
}
