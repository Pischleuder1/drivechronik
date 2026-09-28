import Link from "next/link";
import { ChevronLeft, WandSparkles } from "lucide-react";

import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileRuleFormHero({
  vehicles,
  initialVehicleId,
  title,
  backLabel,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  backLabel: string;
}) {
  return (
    <section className="relative -mx-4 -mt-4 h-[160px] overflow-hidden bg-[#071421] px-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 160"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="ruleFormHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="ruleFormHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          <rect width="420" height="160" fill="url(#ruleFormHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.1"
          >
            <path d="M-20 34 C58 10 121 46 194 30 S330 19 445 41" />
            <path d="M-20 100 C68 69 131 112 213 88 S345 75 445 103" />
            <path d="M71 -20 C88 40 54 100 79 185" />
            <path d="M194 -20 C166 42 208 102 185 185" />
            <path d="M317 -20 C290 40 331 102 306 185" />
          </g>

          <path
            d="M31 133 C75 120 107 125 144 101 C177 80 201 90 232 70 C264 50 296 68 329 51 C356 37 382 39 408 26"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M31 133 C75 120 107 125 144 101 C177 80 201 90 232 70 C264 50 296 68 329 51 C356 37 382 39 408 26"
            fill="none"
            stroke="url(#ruleFormHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
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

      <Link
        href="/rules"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-sky-200/80"
      >
        <ChevronLeft aria-hidden size={14} />
        {backLabel}
      </Link>

      <div className="relative z-10 mt-3 flex items-center gap-2">
        <WandSparkles
          aria-hidden
          size={15}
          className="text-sky-300"
        />

        <h1 className="text-[17px] font-semibold tracking-tight">
          {title}
        </h1>
      </div>
    </section>
  );
}
