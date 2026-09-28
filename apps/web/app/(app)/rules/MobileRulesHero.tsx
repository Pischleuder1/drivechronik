import Link from "next/link";
import { Plus, WandSparkles } from "lucide-react";

import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileRulesHero({
  vehicles,
  initialVehicleId,
  title,
  newRuleLabel,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  newRuleLabel: string;
}) {
  return (
    <section className="relative -mx-4 -mt-4 h-[150px] overflow-hidden bg-[#071421] px-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 150"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="rulesHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="rulesHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#rulesHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.1"
          >
            <path d="M-20 32 C52 11 118 45 190 31 S331 17 445 42" />
            <path d="M-20 93 C59 67 129 103 207 82 S342 70 445 96" />
            <path d="M75 -20 C94 40 56 95 82 180" />
            <path d="M197 -20 C170 39 211 98 187 180" />
            <path d="M320 -20 C294 39 332 97 309 180" />
          </g>

          <path
            d="M27 120 C70 110 98 114 136 91 C171 70 194 83 225 64 C257 45 287 62 321 47 C349 34 378 36 407 24"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M27 120 C70 110 98 114 136 91 C171 70 194 83 225 64 C257 45 287 62 321 47 C349 34 378 36 407 24"
            fill="none"
            stroke="url(#rulesHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g fill="#7dd3fc" opacity="0.45">
            <circle cx="274" cy="48" r="3" />
            <circle cx="307" cy="84" r="2.5" />
            <circle cx="347" cy="54" r="2" />
          </g>
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/15 via-transparent to-[#071421]/90" />
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

      <div className="relative z-10 mt-7 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WandSparkles
            aria-hidden
            size={15}
            className="text-sky-300"
          />

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
            {title}
          </p>
        </div>

        <Link
          href="/rules/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          <Plus aria-hidden size={14} />
          {newRuleLabel}
        </Link>
      </div>
    </section>
  );
}
