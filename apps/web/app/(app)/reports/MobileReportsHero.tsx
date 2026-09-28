import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileReportsHero({
  vehicles,
  initialVehicleId,
  title,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
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
            <linearGradient id="reportsHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="reportsHeroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          <rect width="420" height="150" fill="url(#reportsHeroBg)" />

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

          <g opacity="0.2">
            <rect x="238" y="52" width="108" height="78" rx="8" fill="#38bdf8" />
            <rect x="251" y="67" width="69" height="4" rx="2" fill="white" />
            <rect x="251" y="81" width="82" height="3" rx="1.5" fill="white" opacity="0.7" />
            <rect x="251" y="92" width="72" height="3" rx="1.5" fill="white" opacity="0.7" />
            <rect x="251" y="103" width="79" height="3" rx="1.5" fill="white" opacity="0.7" />
          </g>

          <path
            d="M34 121 C77 109 105 115 140 91 C173 68 200 78 231 63 C264 47 296 62 326 47 C353 34 376 36 402 25"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M34 121 C77 109 105 115 140 91 C173 68 200 78 231 63 C264 47 296 62 326 47 C353 34 376 36 402 25"
            fill="none"
            stroke="url(#reportsHeroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
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

      <p className="relative z-10 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
        {title}
      </p>
    </section>
  );
}
