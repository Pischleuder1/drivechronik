import type { ReactNode } from "react";

import {
  PageHeaderVisual,
  type PageHeaderVisualVariant,
} from "./PageHeaderVisual";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  visual,
  visualText,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  visual?: PageHeaderVisualVariant;
  visualText?: string | number;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950 ${className}`.trim()}
    >
      {visual && <PageHeaderVisual variant={visual} text={visualText} />}
      {visual && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/55 to-white/0 dark:from-neutral-900 dark:via-neutral-900/90 dark:to-neutral-950/30"
        />
      )}

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
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
