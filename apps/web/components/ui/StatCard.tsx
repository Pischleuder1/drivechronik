import type { ReactNode } from "react";
import { IconBadge, type IconBadgeTone } from "./IconBadge";

const topBorder: Record<IconBadgeTone, string> = {
  blue: "border-t-blue-500 dark:border-t-blue-500",
  sky: "border-t-sky-500 dark:border-t-sky-500",
  indigo: "border-t-indigo-500 dark:border-t-indigo-500",
  violet: "border-t-violet-500 dark:border-t-violet-500",
  emerald: "border-t-emerald-500 dark:border-t-emerald-500",
  amber: "border-t-amber-500 dark:border-t-amber-500",
  rose: "border-t-rose-500 dark:border-t-rose-500",
  cyan: "border-t-cyan-500 dark:border-t-cyan-500",
  neutral: "border-t-neutral-400 dark:border-t-neutral-500",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  footer,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: IconBadgeTone;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-t-4 border-neutral-200 ${topBorder[tone]} bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {label}
          </p>

          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {value}
          </div>

          {hint && (
            <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {hint}
            </div>
          )}

          {footer && <div className="mt-2">{footer}</div>}
        </div>

        {icon && (
          <IconBadge tone={tone} size="sm">
            {icon}
          </IconBadge>
        )}
      </div>
    </div>
  );
}
