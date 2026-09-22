import Link from "next/link";
import {
  BarChart3,
  BatteryCharging,
  ChevronRight,
  FileText,
  Route,
  Settings2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function QuickAccessCard() {
  const t = await getTranslations("dashboard.quickAccess");

  const items = [
    { href: "/planner", label: t("planner"), icon: Route },
    { href: "/charges", label: t("charges"), icon: BatteryCharging },
    { href: "/reports", label: t("reports"), icon: FileText },
    { href: "/insights", label: t("insights"), icon: BarChart3 },
    { href: "/settings", label: t("settings"), icon: Settings2 },
  ];

  return (
    <section className="h-full rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="px-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {t("title")}
      </h2>

      <div className="mt-3 grid gap-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5 transition-colors hover:bg-neutral-100 dark:bg-neutral-800/55 dark:hover:bg-neutral-800"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-500 shadow-sm ring-1 ring-neutral-200 group-hover:text-blue-600 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700">
              <Icon aria-hidden size={16} strokeWidth={1.8} />
            </span>

            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {label}
            </span>

            <ChevronRight
              aria-hidden
              size={15}
              className="text-neutral-400 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
