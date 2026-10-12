"use client";

import { useState } from "react";
import { CarFront, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DesktopNav } from "./DesktopNav";
import { BrandWordmark } from "./BrandWordmark";
import { ThemeToggle, type ThemeChoice } from "./ThemeToggle";
import { LocaleSwitcher, type Locale } from "./LocaleSwitcher";
import { ActiveVehicleSwitcher } from "./ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

interface DesktopShellProps {
  vehicles: VehicleOption[];
  activeVehicleId?: number;
  theme: ThemeChoice;
  locale: Locale;
}

export function DesktopShell({
  vehicles,
  activeVehicleId,
  theme,
  locale,
}: DesktopShellProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col
        border-r border-neutral-200 bg-white
        transition-[width] duration-200 md:flex
        dark:border-neutral-800 dark:bg-neutral-950
        ${expanded ? "w-[248px]" : "w-[76px]"}`}
    >
      <div className={`flex shrink-0 items-center gap-1 ${expanded ? "h-16 justify-between px-2" : "flex-col py-2"}`}>
        <Link href="/" aria-label="DriveChronik Startseite">
          <Image
            src="/brand/drivechronik-logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
        </Link>
        {expanded && (
          <BrandWordmark size="xs" />
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
          aria-expanded={expanded}
          title={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          {expanded ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
        </button>
      </div>

      {expanded && activeVehicleId !== undefined && (
        <div className="shrink-0 border-b border-neutral-200 px-3 pb-2 dark:border-neutral-800">
          {vehicles.length > 1 ? (
            <ActiveVehicleSwitcher
              vehicles={vehicles}
              initialVehicleId={activeVehicleId}
            />
          ) : (
            <p className="truncate px-2 text-sm text-neutral-500 dark:text-neutral-400">
              {vehicles.find((v) => v.id === activeVehicleId)?.displayName}
            </p>
          )}
        </div>
      )}

      {!expanded && activeVehicleId !== undefined && (
        <div className="flex justify-center border-b border-neutral-200 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Fahrzeugauswahl öffnen"
            title="Fahrzeugauswahl öffnen"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <CarFront size={21} />
          </button>
        </div>
      )}

      <DesktopNav expanded={expanded} />

      <div className="shrink-0 border-t border-neutral-200 p-3 dark:border-neutral-800">
        {expanded ? (
          <div className="flex flex-col gap-2">
            <ThemeToggle initial={theme} variant="segmented" />
            <LocaleSwitcher initial={locale} variant="segmented" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle initial={theme} variant="compact" />
            <LocaleSwitcher initial={locale} variant="compact" />
          </div>
        )}
      </div>
    </aside>
  );
}
