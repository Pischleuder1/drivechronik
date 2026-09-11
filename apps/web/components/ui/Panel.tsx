import type { ReactNode } from "react";

type PanelPadding = "none" | "sm" | "md";

const paddingClasses: Record<PanelPadding, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
};

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
  padding = "md",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: PanelPadding;
}) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`.trim()}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 dark:border-neutral-800">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
      )}

      <div className={`${paddingClasses[padding]} ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
}
