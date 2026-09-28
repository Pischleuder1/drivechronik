import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileJourneysHero({
  vehicles,
  initialVehicleId,
  displayName,
  pageTitle,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
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
            <linearGradient id="journeyHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="journeyHeroRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#10b981" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#journeyHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.12"
          >
            <path d="M-20 31 C61 7 119 45 192 29 S324 17 445 39" />
            <path d="M-20 83 C70 57 128 96 212 74 S342 61 445 89" />
            <path d="M70 -20 C86 35 51 92 77 170" />
            <path d="M190 -20 C163 39 205 94 183 170" />
            <path d="M311 -20 C286 38 327 95 302 170" />
          </g>

          <path
            d="M29 113 C72 99 91 105 122 83 C158 57 189 70 220 54 C256 36 288 57 322 41 C346 30 367 34 398 22"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.38"
          />

          <path
            d="M29 113 C72 99 91 105 122 83 C158 57 189 70 220 54 C256 36 288 57 322 41 C346 30 367 34 398 22"
            fill="none"
            stroke="url(#journeyHeroRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="29" cy="113" r="5.5" fill="#10b981" />
          <circle cx="29" cy="113" r="2.2" fill="white" />

          <circle cx="398" cy="22" r="5.5" fill="#8b5cf6" />
          <circle cx="398" cy="22" r="2.2" fill="white" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/25 via-transparent to-[#071421]/90" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[18px] font-semibold tracking-tight">
          DriveChronik
        </span>

        {vehicles.length > 1 ? (
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
