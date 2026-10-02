import type { ReactNode } from "react";

export function MetricGrid({
  children,
  columns = 4,
  mobileColumns = 2,
  className = "",
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  mobileColumns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
  }[columns];

  const mobileCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  }[mobileColumns];

  return (
    <dl className={`grid ${mobileCols} gap-2 ${cols} ${className}`.trim()}>
      {children}
    </dl>
  );
}

export function MetricItem({
  label,
  value,
  icon,
  muted = false,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/70 ${className}`.trim()}
    >
      <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </dt>

      <dd
        className={`mt-1 font-medium tabular-nums ${
          muted
            ? "text-neutral-400 dark:text-neutral-500"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
