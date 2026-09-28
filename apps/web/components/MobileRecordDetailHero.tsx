import Link from "next/link";
import { ChevronLeft, Route, Zap } from "lucide-react";

import { ActiveVehicleSwitcher } from "./ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileRecordDetailHero({
  vehicles,
  initialVehicleId,
  title,
  subtitle,
  backHref,
  backLabel,
  mode,
  badge,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  mode: "drive" | "charge";
  badge?: React.ReactNode;
}) {
  const Icon = mode === "drive" ? Route : Zap;

  return (
    <section className="relative -mx-4 -mt-4 min-h-[170px] overflow-hidden bg-[#071421] px-4 pb-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 170"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id={`detailHeroBg-${mode}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id={`detailHeroLine-${mode}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#67e8f9" />
            </linearGradient>
          </defs>

          <rect
            width="420"
            height="170"
            fill={`url(#detailHeroBg-${mode})`}
          />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.1"
          >
            <path d="M-20 35 C58 10 121 47 194 31 S330 20 445 42" />
            <path d="M-20 104 C68 74 131 116 213 91 S345 79 445 108" />
            <path d="M71 -20 C88 44 54 106 79 190" />
            <path d="M194 -20 C166 45 208 108 185 190" />
            <path d="M317 -20 C290 43 331 108 306 190" />
          </g>

          <path
            d="M31 139 C74 125 107 130 144 104 C177 81 201 92 232 71 C264 50 296 69 328 52 C355 38 382 40 408 27"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M31 139 C74 125 107 130 144 104 C177 81 201 92 232 71 C264 50 296 69 328 52 C355 38 382 40 408 27"
            fill="none"
            stroke={`url(#detailHeroLine-${mode})`}
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {mode === "charge" && (
            <g
              fill="none"
              stroke="#7dd3fc"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
            >
              <path
                d="M316 36l-22 37h19l-8 29 28-43h-20z"
                strokeWidth="4"
              />
            </g>
          )}
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/10 via-transparent to-[#071421]/95" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[18px] font-semibold tracking-tight">
          DriveChronik
        </span>

        {initialVehicleId != null && vehicles.length > 1 && (
          <div className="rounded-lg bg-white/95 shadow-lg shadow-black/10 [&_select]:!max-w-[120px] [&_select]:!px-1.5 [&_select]:!py-0.5 [&_select]:!text-[11px]">
            <ActiveVehicleSwitcher
              vehicles={vehicles}
              initialVehicleId={initialVehicleId}
              compact
            />
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-sky-200/80"
        >
          <ChevronLeft aria-hidden size={14} />
          {backLabel}
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon
                aria-hidden
                size={15}
                className="shrink-0 text-sky-300"
              />

              <h1 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">
                {title}
              </h1>
            </div>

            <p className="mt-1.5 text-[12px] tabular-nums text-slate-300">
              {subtitle}
            </p>
          </div>

          {badge && (
            <div className="shrink-0 pt-0.5">
              {badge}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
