import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileSearchHero({
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
            <linearGradient id="searchHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="searchHeroRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#searchHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.12"
          >
            <path d="M-20 30 C60 8 117 46 184 28 S315 18 445 38" />
            <path d="M-20 82 C67 56 124 95 210 73 S340 63 445 89" />
            <path d="M-20 126 C78 102 151 137 231 116 S347 101 445 126" />
            <path d="M65 -20 C83 30 45 91 76 170" />
            <path d="M177 -20 C152 40 194 91 174 170" />
            <path d="M300 -20 C275 39 316 96 289 170" />
          </g>

          <path
            d="M30 113 C74 97 91 105 122 82 C156 56 189 69 220 53 C257 34 289 58 320 42"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.38"
          />

          <path
            d="M30 113 C74 97 91 105 122 82 C156 56 189 69 220 53 C257 34 289 58 320 42"
            fill="none"
            stroke="url(#searchHeroRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle
            cx="351"
            cy="58"
            r="19"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="4"
            opacity="0.18"
          />
          <path
            d="M365 72 L386 93"
            stroke="#f8fafc"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.18"
          />

          <circle cx="30" cy="113" r="5.5" fill="#38bdf8" />
          <circle cx="30" cy="113" r="2.3" fill="white" />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/30 via-transparent to-[#071421]/90" />
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
