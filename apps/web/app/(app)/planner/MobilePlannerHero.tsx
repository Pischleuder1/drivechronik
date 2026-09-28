import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobilePlannerHero({
  vehicles,
  initialVehicleId,
  title,
  experimentalLabel,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
  title: string;
  experimentalLabel: string;
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
            <linearGradient id="plannerHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="plannerHeroRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          <rect width="420" height="160" fill="url(#plannerHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.11"
          >
            <path d="M-20 32 C61 8 120 47 194 29 S330 18 445 40" />
            <path d="M-20 92 C69 64 130 105 215 81 S345 69 445 97" />
            <path d="M70 -20 C86 38 52 96 78 190" />
            <path d="M192 -20 C164 40 207 98 184 190" />
            <path d="M315 -20 C288 38 329 100 304 190" />
          </g>

          <path
            d="M27 126 C72 111 91 119 124 95 C159 69 191 82 223 64 C258 45 290 66 324 49 C350 36 372 39 400 27"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M27 126 C72 111 91 119 124 95 C159 69 191 82 223 64 C258 45 290 66 324 49 C350 36 372 39 400 27"
            fill="none"
            stroke="url(#plannerHeroRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="27" cy="126" r="5.5" fill="#38bdf8" />
          <circle cx="27" cy="126" r="2.2" fill="white" />

          <circle cx="400" cy="27" r="5.5" fill="#60a5fa" />
          <circle cx="400" cy="27" r="2.2" fill="white" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/20 via-transparent to-[#071421]/92" />
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

      <div className="relative z-10 mt-7">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
            {title}
          </p>

          <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] font-medium text-sky-200/80">
            {experimentalLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
