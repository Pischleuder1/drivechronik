"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

    return `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] transition-colors ${state}`.trim();
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
      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          <div
            id="mobile-navigation-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[28px] border border-neutral-200 bg-[#f4f6f8] shadow-2xl md:hidden dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="relative h-[132px] overflow-hidden bg-[#071421] px-4 pt-4 text-white">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
              >
                <svg
                  viewBox="0 0 420 132"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                >
                  <defs>
                    <linearGradient
                      id="menuHeroBg"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#0a2440" />
                      <stop offset="1" stopColor="#071421" />
                    </linearGradient>

                    <linearGradient
                      id="menuHeroRoute"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0" stopColor="#22c55e" />
                      <stop offset="0.5" stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>

                  <rect
                    width="420"
                    height="132"
                    fill="url(#menuHeroBg)"
                  />

                  <g
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    opacity="0.12"
                  >
                    <path d="M-20 30 C60 8 118 43 184 29 S318 17 445 40" />
                    <path d="M-20 81 C73 55 128 96 211 73 S341 61 445 88" />
                    <path d="M68 -20 C80 32 50 84 77 155" />
                    <path d="M181 -20 C153 39 195 88 173 155" />
                    <path d="M304 -20 C280 36 319 90 294 155" />
                  </g>

                  <path
                    d="M24 106 C70 92 91 101 122 78 C157 53 190 67 222 51 C258 33 289 53 323 37 C345 27 366 30 398 19"
                    fill="none"
                    stroke="#020617"
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.35"
                  />

                  <path
                    d="M24 106 C70 92 91 101 122 78 C157 53 190 67 222 51 C258 33 289 53 323 37 C345 27 366 30 398 19"
                    fill="none"
                    stroke="url(#menuHeroRoute)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#071421]/85" />
              </div>

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-[18px] font-semibold tracking-tight">
                    DriveChronik
                  </p>

                  <p
                    id="mobile-menu-title"
                    className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80"
                  >
                    {t("menuTitle")}
                  </p>

                  <p className="mt-1 text-[11px] text-white/60">
                    {t("menuSubtitle")}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={t("closeMenu")}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
                >
                  <X
                    aria-hidden
                    size={18}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
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
                    <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">
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
                                ? "flex min-h-14 items-center gap-3 rounded-[16px] border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-800 shadow-sm dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
                                : "flex min-h-14 items-center gap-3 rounded-[16px] border border-neutral-200 bg-white px-3 py-2.5 text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
          </>,
          document.body,
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
