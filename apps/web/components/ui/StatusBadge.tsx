import type { ReactNode } from "react";

export type StatusBadgeTone =
  | "blue"
  | "sky"
  | "indigo"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "neutral";

const tones: Record<StatusBadgeTone, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function StatusBadge({
  children,
  tone = "neutral",
  uppercase = false,
  className = "",
}: {
  children: ReactNode;
  tone?: StatusBadgeTone;
  uppercase?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        uppercase ? "uppercase" : ""
      } ${tones[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
