import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActiveVehicleSwitcher } from "../../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileJourneyDetailHero({
  vehicles,
  initialVehicleId,
  journeyName,
  typeLabel,
  dateRange,
  color,
  backLabel,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
  journeyName: string;
  typeLabel: string;
  dateRange: string;
  color: string | null;
  backLabel: string;
}) {
  return (
    <section className="relative -mx-4 -mt-4 h-[205px] overflow-hidden bg-[#071421] px-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 205"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="journeyDetailBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="journeyDetailRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#10b981" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="205" fill="url(#journeyDetailBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.11"
          >
            <path d="M-20 34 C64 10 119 48 194 30 S330 20 445 42" />
            <path d="M-20 94 C68 66 128 108 214 83 S345 71 445 99" />
            <path d="M-20 158 C75 131 144 171 225 147 S349 136 445 163" />
            <path d="M69 -20 C87 45 52 111 79 230" />
            <path d="M190 -20 C163 44 207 115 184 230" />
            <path d="M312 -20 C285 45 330 116 303 230" />
          </g>

          <path
            d="M28 164 C71 149 91 156 124 131 C159 105 191 118 223 99 C259 78 290 99 324 79 C350 64 372 67 400 53"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.38"
          />

          <path
            d="M28 164 C71 149 91 156 124 131 C159 105 191 118 223 99 C259 78 290 99 324 79 C350 64 372 67 400 53"
            fill="none"
            stroke="url(#journeyDetailRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="28" cy="164" r="5.5" fill="#10b981" />
          <circle cx="400" cy="53" r="5.5" fill="#8b5cf6" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/20 via-transparent to-[#071421]/95" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[18px] font-semibold tracking-tight">
          DriveChronik
        </span>

        {vehicles.length > 1 && (
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
        href="/journeys"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-white/65"
      >
        <ChevronLeft aria-hidden size={14} />
        {backLabel}
      </Link>

      <div className="relative z-10 mt-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "#94a3b8" }}
          />

          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/75">
            {typeLabel}
          </span>
        </div>

        <h1 className="mt-1.5 truncate text-[21px] font-semibold tracking-tight">
          {journeyName}
        </h1>

        <p className="mt-0.5 text-[11px] tabular-nums text-white/60">
          {dateRange}
        </p>
      </div>
    </section>
  );
}
