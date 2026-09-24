"use client";

import { useEffect, useState } from "react";
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
  Settings,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Direkt in der mobilen Bottom-Bar sichtbar. */
  mobilePrimary?: boolean;
}

const items: NavItem[] = [
  {
    href: "/",
    labelKey: "start",
    icon: House,
    match: (p) => p === "/",
    mobilePrimary: true,
  },
  {
    href: "/vehicle",
    labelKey: "vehicle",
    icon: Car,
    match: (p) => p.startsWith("/vehicle"),
  },
  {
    href: "/day",
    labelKey: "day",
    icon: CalendarDays,
    match: (p) =>
      p.startsWith("/day") ||
      p.startsWith("/drives"),
    mobilePrimary: true,
  },
  {
    href: "/calendar",
    labelKey: "calendar",
    icon: CalendarRange,
    match: (p) => p.startsWith("/calendar"),
  },
  {
    href: "/search",
    labelKey: "search",
    icon: Search,
    match: (p) => p.startsWith("/search"),
    mobilePrimary: true,
  },
  {
    href: "/journeys",
    labelKey: "journeys",
    icon: Route,
    match: (p) => p.startsWith("/journeys"),
  },
  {
    href: "/charges",
    labelKey: "charges",
    icon: Zap,
    match: (p) => p.startsWith("/charges"),
    mobilePrimary: true,
  },
  {
    href: "/places",
    labelKey: "places",
    icon: MapPin,
    match: (p) => p.startsWith("/places"),
  },
  {
    href: "/reports",
    labelKey: "reports",
    icon: FileBarChart,
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/insights",
    labelKey: "insights",
    icon: Lightbulb,
    match: (p) => p.startsWith("/insights"),
  },
  {
    href: "/planner",
    labelKey: "planner",
    icon: Navigation,
    match: (p) => p.startsWith("/planner"),
  },
  {
    href: "/settings",
    labelKey: "settings",
    icon: Settings,
    match: (p) =>
      p.startsWith("/settings") ||
      p.startsWith("/tags") ||
      p.startsWith("/rules") ||
      p.startsWith("/import") ||
      p.startsWith("/export"),
  },
];

const mobileMenuGroups = [
  {
    labelKey: "menuQuickAccess",
    hrefs: ["/vehicle", "/planner"],
  },
  {
    labelKey: "menuTripsPlanning",
    hrefs: ["/calendar", "/journeys", "/places"],
  },
  {
    labelKey: "menuAnalytics",
    hrefs: ["/insights", "/reports"],
  },
  {
    labelKey: "menuAdministration",
    hrefs: ["/settings"],
  },
] as const;

function itemClasses(
  active: boolean,
  layout: "bottom" | "side",
): string {
  if (layout === "bottom") {
    const state = active
      ? "text-neutral-900 dark:text-white font-medium"
      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white";

    return `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${state}`.trim();
  }

  const state = active
    ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950/50 dark:text-sky-300"
    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white";

  return `flex items-center gap-4 rounded-xl px-4 py-1.5 text-[15px] transition-colors ${state}`.trim();
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [menuOpen]);

  const primaryItems = items.filter(
    (item) => item.mobilePrimary,
  );

  const menuActive = items.some(
    (item) =>
      !item.mobilePrimary &&
      item.match(pathname),
  );

  return (
    <>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl md:hidden dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p
                  id="mobile-menu-title"
                  className="text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  {t("menuTitle")}
                </p>

                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t("menuSubtitle")}
                </p>
              </div>

              <button
                type="button"
                aria-label={t("closeMenu")}
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
              >
                <X
                  aria-hidden
                  size={20}
                />
              </button>
            </div>

            <div className="space-y-5">
              {mobileMenuGroups.map((group) => {
                const groupItems = group.hrefs
                  .map((href) =>
                    items.find(
                      (item) =>
                        item.href === href,
                    ),
                  )
                  .filter(
                    (item): item is NavItem =>
                      Boolean(item),
                  );

                return (
                  <section key={group.labelKey}>
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      {t(group.labelKey)}
                    </h2>

                    <div className="grid grid-cols-2 gap-2">
                      {groupItems.map((item) => {
                        const active =
                          item.match(pathname);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() =>
                              setMenuOpen(false)
                            }
                            className={
                              active
                                ? "flex min-h-16 items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
                                : "flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200 dark:hover:bg-neutral-900"
                            }
                          >
                            <Icon
                              aria-hidden
                              size={21}
                              strokeWidth={
                                active
                                  ? 2.25
                                  : 1.9
                              }
                              className="shrink-0"
                            />

                            <span className="text-sm font-medium">
                              {t(
                                item.labelKey,
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
        {primaryItems.map((item) => {
          const active =
            item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={itemClasses(
                active,
                "bottom",
              )}
            >
              <Icon
                aria-hidden
                size={20}
                strokeWidth={
                  active ? 2.25 : 2
                }
              />

              <span>
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-menu"
          onClick={() =>
            setMenuOpen((open) => !open)
          }
          className={itemClasses(
            menuActive || menuOpen,
            "bottom",
          )}
        >
          <Menu
            aria-hidden
            size={20}
            strokeWidth={
              menuActive || menuOpen
                ? 2.25
                : 2
            }
          />

          <span>{t("menu")}</span>
        </button>
      </nav>
    </>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active =
            item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={itemClasses(
                active,
                "side",
              )}
            >
              <Icon
                aria-hidden
                size={21}
                strokeWidth={
                  active ? 2.25 : 1.9
                }
                className="shrink-0"
              />

              <span>
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
