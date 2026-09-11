import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950 ${className}`.trim()}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {eyebrow}
            </div>
          )}

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
