import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileInsightsHero({
  vehicles,
  initialVehicleId,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
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
            <linearGradient id="insightsHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="insightsHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#insightsHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.11"
          >
            <path d="M-20 34 C63 10 120 46 195 30 S330 19 445 41" />
            <path d="M-20 91 C70 63 130 104 214 81 S345 70 445 97" />
            <path d="M70 -20 C86 38 52 95 78 180" />
            <path d="M192 -20 C164 40 207 96 184 180" />
            <path d="M315 -20 C288 38 329 98 304 180" />
          </g>

          <g opacity="0.22" fill="#38bdf8">
            <rect x="58" y="91" width="18" height="31" rx="3" />
            <rect x="91" y="76" width="18" height="46" rx="3" />
            <rect x="124" y="83" width="18" height="39" rx="3" />
            <rect x="157" y="59" width="18" height="63" rx="3" />
            <rect x="190" y="66" width="18" height="56" rx="3" />
          </g>

          <path
            d="M48 106 C87 101 105 88 137 91 C171 94 185 69 218 72 C253 75 268 46 302 52 C334 58 354 38 395 31"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.34"
          />

          <path
            d="M48 106 C87 101 105 88 137 91 C171 94 185 69 218 72 C253 75 268 46 302 52 C334 58 354 38 395 31"
            fill="none"
            stroke="url(#insightsHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="218" cy="72" r="5" fill="#38bdf8" />
          <circle cx="218" cy="72" r="2" fill="white" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/15 via-transparent to-[#071421]/90" />
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

      <p className="relative z-10 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
        AUSWERTUNGEN
      </p>
    </section>
  );
}
