import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileChargesHero({
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
            <linearGradient id="chargeHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#09233c" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="chargeHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#22c55e" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#chargeHeroBg)" />

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
            d="M20 116 C62 113 72 94 105 96 C143 99 151 59 190 63 C228 67 235 42 274 49 C308 55 324 27 400 31"
            fill="none"
            stroke="#020617"
            strokeWidth="9"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M20 116 C62 113 72 94 105 96 C143 99 151 59 190 63 C228 67 235 42 274 49 C308 55 324 27 400 31"
            fill="none"
            stroke="url(#chargeHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <path
            d="M318 38 L297 76 H318 L305 112 L344 63 H322 L340 38 Z"
            fill="#f8fafc"
            opacity="0.12"
          />
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

      <p className="relative z-10 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
        {pageTitle}
      </p>
    </section>
  );
}
