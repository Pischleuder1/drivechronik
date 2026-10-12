"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { items } from "./Nav";

const desktopGroups = [
  { id: "overview", label: "Übersicht", labelEn: "Overview", hrefs: ["/", "/vehicle"] },
  { id: "trips", label: "Fahrten & Planung", labelEn: "Trips & Planning", hrefs: ["/day", "/calendar", "/search", "/journeys", "/planner"] },
  { id: "energy", label: "Energie", labelEn: "Energy", hrefs: ["/charges"] },
  { id: "analytics", label: "Auswertungen", labelEn: "Analytics", hrefs: ["/places", "/reports", "/insights"] },
  { id: "admin", label: "Verwaltung", labelEn: "Administration", hrefs: ["/settings"] },
] as const;

function getGroupItems(hrefs: readonly string[]) {
  return hrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is (typeof items)[number] => item !== undefined);
}

function isGroupActive(
  hrefs: readonly string[],
  pathname: string
): boolean {
  return items.some(
    (item) =>
      hrefs.includes(item.href) &&
      item.match(pathname)
  );
}

export function DesktopNav({ expanded }: { expanded: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const locale = useLocale();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  function toggleGroup(id: string) {
    setClosedGroups((current) =>
      current.includes(id)
        ? current.filter((group) => group !== id)
        : [...current, id]
    );
  }

  return (
    <nav
      aria-label="Desktop navigation"
      className="hidden min-h-0 flex-1 flex-col md:flex"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {(expanded ? desktopGroups : [{ id: "all", hrefs: items.map((item) => item.href) }]).map((group) => {
            const groupItems = getGroupItems(group.hrefs);
            const groupActive = isGroupActive(group.hrefs, pathname);
            const closed = closedGroups.includes(group.id) && !groupActive;

            return (
              <div key={group.id}>
                {expanded && "label" in group && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!closed}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                  >
                    <span>{locale === "en" ? group.labelEn : group.label}</span>
                    <ChevronDown
                      size={15}
                      className={`transition-transform ${closed ? "-rotate-90" : ""}`}
                    />
                  </button>
                )}
                {!closed && groupItems.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const label = t(item.labelKey);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? label : undefined}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center rounded-xl transition-colors ${
                  expanded ? "gap-3 px-3" : "justify-center px-2"
                } ${
                  active
                    ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  size={21}
                  strokeWidth={active ? 2.25 : 1.9}
                  className="shrink-0"
                />
                {expanded && (
                  <span className="truncate text-sm">{label}</span>
                )}
              </Link>
            );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
