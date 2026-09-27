import { ActiveVehicleSwitcher } from "../../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileDayHero({
  vehicles,
  initialVehicleId,
  displayName,
  pageTitle,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
  displayName: string;
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
          className="h-full w-full opacity-70"
        >
          <defs>
            <linearGradient id="dayHeroFade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0b2038" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="dayHeroRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1d4ed8" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#dayHeroFade)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.14"
          >
            <path d="M-20 28 C60 12 92 48 158 32 S276 8 448 34" />
            <path d="M-10 72 C62 50 124 82 188 65 S307 41 440 76" />
            <path d="M-20 121 C52 96 118 124 190 112 S330 90 450 123" />
            <path d="M48 -20 C62 34 38 86 69 174" />
            <path d="M148 -20 C126 37 169 88 146 174" />
            <path d="M264 -20 C240 45 284 97 260 174" />
            <path d="M368 -20 C340 35 383 88 356 174" />
          </g>

          <path
            d="M36 117 C76 96 98 106 125 83 C154 57 188 69 218 54 C255 35 282 55 309 40 C337 24 367 34 392 20"
            fill="none"
            stroke="#0b1220"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />

          <path
            d="M36 117 C76 96 98 106 125 83 C154 57 188 69 218 54 C255 35 282 55 309 40 C337 24 367 34 392 20"
            fill="none"
            stroke="url(#dayHeroRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="36" cy="117" r="6" fill="#3b82f6" />
          <circle cx="36" cy="117" r="2.5" fill="white" />

          <circle cx="392" cy="20" r="6" fill="#22d3ee" />
          <circle cx="392" cy="20" r="2.5" fill="white" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/40 via-transparent to-[#071421]/90" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[18px] font-semibold tracking-tight text-white">
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
        ) : (
          <span className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            {displayName}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200/80">
          {pageTitle}
        </p>
      </div>
    </section>
  );
}
