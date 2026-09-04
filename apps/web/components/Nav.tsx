"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  House,
  Car,
  CalendarDays,
  CalendarRange,
  Search,
  Route,
  Zap,
  MapPin,
  FileBarChart,
  Lightbulb,
  Navigation,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Nur in der Desktop-Sidebar — die Bottom-Bar bleibt bei 5 Slots. */
  sideOnly?: boolean;
}

const items: NavItem[] = [
  { href: "/", labelKey: "start", icon: House, match: (p) => p === "/" },
  { href: "/vehicle", labelKey: "vehicle", icon: Car, match: (p) => p.startsWith("/vehicle"), sideOnly: true },
  { href: "/day", labelKey: "day", icon: CalendarDays, match: (p) => p.startsWith("/day") || p.startsWith("/drives") },
  { href: "/calendar", labelKey: "calendar", icon: CalendarRange, match: (p) => p.startsWith("/calendar"), sideOnly: true },
  { href: "/search", labelKey: "search", icon: Search, match: (p) => p.startsWith("/search") },
  { href: "/journeys", labelKey: "journeys", icon: Route, match: (p) => p.startsWith("/journeys"), sideOnly: true },
  { href: "/charges", labelKey: "charges", icon: Zap, match: (p) => p.startsWith("/charges") },
  { href: "/places", labelKey: "places", icon: MapPin, match: (p) => p.startsWith("/places"), sideOnly: true },
  { href: "/reports", labelKey: "reports", icon: FileBarChart, match: (p) => p.startsWith("/reports"), sideOnly: true },
  { href: "/insights", labelKey: "insights", icon: Lightbulb, match: (p) => p.startsWith("/insights"), sideOnly: true },
  { href: "/planner", labelKey: "planner", icon: Navigation, match: (p) => p.startsWith("/planner"), sideOnly: true },
  { href: "/settings", labelKey: "more", icon: Ellipsis, match: (p) => p.startsWith("/settings") || p.startsWith("/tags") || p.startsWith("/rules") || p.startsWith("/import") },
];

function itemClasses(active: boolean, layout: "bottom" | "side"): string {
  if (layout === "bottom") {
    const state = active
      ? "text-neutral-900 dark:text-white font-medium"
      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white";

    return `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${state}`.trim();
  }

  const state = active
    ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950/50 dark:text-sky-300"
    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white";

  return `flex items-center gap-4 rounded-xl px-4 py-2.5 text-[15px] transition-colors ${state}`.trim();
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
      {items.filter((item) => !item.sideOnly).map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={itemClasses(active, "bottom")}
          >
            <Icon aria-hidden size={20} strokeWidth={active ? 2.25 : 2} />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="flex flex-col gap-1.5">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={itemClasses(active, "side")}
          >
            <Icon aria-hidden size={21} strokeWidth={active ? 2.25 : 1.9} className="shrink-0" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
