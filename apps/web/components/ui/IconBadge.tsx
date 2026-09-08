import type { ReactNode } from "react";

export type IconBadgeTone =
  | "blue"
  | "indigo"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "neutral";

const toneClasses: Record<IconBadgeTone, string> = {
  blue:
    "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60",
  indigo:
    "bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/60",
  violet:
    "bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60",
  emerald:
    "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
  amber:
    "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60",
  rose:
    "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60",
  cyan:
    "bg-cyan-50 text-cyan-600 ring-1 ring-inset ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900/60",
  neutral:
    "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
};

export function IconBadge({
  children,
  tone = "neutral",
  size = "md",
}: {
  children: ReactNode;
  tone?: IconBadgeTone;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-9 w-9 rounded-xl"
      : size === "lg"
        ? "h-12 w-12 rounded-2xl"
        : "h-10 w-10 rounded-2xl";

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${sizeClass} ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
