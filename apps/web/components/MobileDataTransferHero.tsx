import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import { ActiveVehicleSwitcher } from "./ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileDataTransferHero({
  vehicles,
  initialVehicleId,
  title,
  mode,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  mode: "import" | "export";
}) {
  const Icon = mode === "import" ? ArrowDownToLine : ArrowUpFromLine;

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
            <linearGradient id={`dataHeroBg-${mode}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id={`dataHeroLine-${mode}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#67e8f9" />
            </linearGradient>
          </defs>

          <rect
            width="420"
            height="150"
            fill={`url(#dataHeroBg-${mode})`}
          />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.1"
          >
            <path d="M-20 34 C58 10 121 46 194 30 S330 19 445 41" />
            <path d="M-20 91 C68 65 131 103 213 81 S345 71 445 97" />
            <path d="M71 -20 C88 38 54 96 79 180" />
            <path d="M194 -20 C166 40 208 97 185 180" />
            <path d="M317 -20 C290 38 331 98 306 180" />
          </g>

          <path
            d="M32 121 C75 109 108 113 145 91 C178 72 202 80 232 63 C265 44 297 62 330 46 C356 33 382 35 408 24"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M32 121 C75 109 108 113 145 91 C178 72 202 80 232 63 C265 44 297 62 330 46 C356 33 382 35 408 24"
            fill="none"
            stroke={`url(#dataHeroLine-${mode})`}
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g
            fill="none"
            stroke="#7dd3fc"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.33"
          >
            <rect x="283" y="43" width="56" height="46" rx="7" strokeWidth="3" />
            <path
              d={
                mode === "import"
                  ? "M311 31v34m-11-11 11 11 11-11"
                  : "M311 74V40m-11 11 11-11 11 11"
              }
              strokeWidth="4"
            />
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

      <div className="relative z-10 mt-7 flex items-center gap-2">
        <Icon aria-hidden size={15} className="text-sky-300" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
          {title}
        </p>
      </div>
    </section>
  );
}
