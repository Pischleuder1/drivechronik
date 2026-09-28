import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileCalendarHero({
  vehicles,
  initialVehicleId,
  displayName,
  pageTitle,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  displayName: string | null;
  pageTitle: string;
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
            <linearGradient id="calendarHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="calendarHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#calendarHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.12"
          >
            <path d="M0 34 H420" />
            <path d="M0 72 H420" />
            <path d="M0 110 H420" />
            <path d="M60 0 V150" />
            <path d="M145 0 V150" />
            <path d="M230 0 V150" />
            <path d="M315 0 V150" />
          </g>

          <path
            d="M25 112 C67 103 87 80 127 85 C169 90 184 57 225 61 C270 66 292 40 326 44 C353 47 375 35 402 26"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.36"
          />

          <path
            d="M25 112 C67 103 87 80 127 85 C169 90 184 57 225 61 C270 66 292 40 326 44 C353 47 375 35 402 26"
            fill="none"
            stroke="url(#calendarHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g opacity="0.14" stroke="#f8fafc" strokeWidth="3">
            <rect
              x="326"
              y="73"
              width="55"
              height="48"
              rx="8"
              fill="none"
            />
            <path d="M326 88 H381" />
            <path d="M340 66 V80" strokeLinecap="round" />
            <path d="M367 66 V80" strokeLinecap="round" />
          </g>
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/20 via-transparent to-[#071421]/90" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[18px] font-semibold tracking-tight">
          DriveChronik
        </span>

        {initialVehicleId != null && vehicles.length > 1 ? (
          <div className="rounded-lg bg-white/95 shadow-lg shadow-black/10 [&_select]:!max-w-[120px] [&_select]:!px-1.5 [&_select]:!py-0.5 [&_select]:!text-[11px]">
            <ActiveVehicleSwitcher
              vehicles={vehicles}
              initialVehicleId={initialVehicleId}
              compact
            />
          </div>
        ) : displayName ? (
          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
            {displayName}
          </span>
        ) : null}
      </div>

      <p className="relative z-10 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
        {pageTitle}
      </p>
    </section>
  );
}
