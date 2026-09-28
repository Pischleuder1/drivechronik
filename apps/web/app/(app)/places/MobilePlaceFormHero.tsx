import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobilePlaceFormHero({
  vehicles,
  initialVehicleId,
  title,
  backHref,
  backLabel,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="relative -mx-4 -mt-4 h-[165px] overflow-hidden bg-[#071421] px-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 165"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="placeFormBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="placeFormRoute" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          <rect width="420" height="165" fill="url(#placeFormBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.11"
          >
            <path d="M-20 34 C64 10 120 47 194 30 S330 19 445 41" />
            <path d="M-20 91 C70 64 130 105 215 82 S345 70 445 97" />
            <path d="M70 -20 C86 39 52 96 78 190" />
            <path d="M192 -20 C164 41 207 98 184 190" />
            <path d="M315 -20 C288 38 329 101 304 190" />
          </g>

          <path
            d="M28 126 C72 111 94 118 126 94 C160 69 192 82 224 64 C259 45 291 66 324 49 C351 36 372 39 399 28"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M28 126 C72 111 94 118 126 94 C160 69 192 82 224 64 C259 45 291 66 324 49 C351 36 372 39 399 28"
            fill="none"
            stroke="url(#placeFormRoute)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g transform="translate(224 64)">
            <circle r="15" fill="#38bdf8" opacity="0.16" />
            <circle r="6" fill="#38bdf8" />
            <circle r="2.5" fill="white" />
          </g>
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/20 via-transparent to-[#071421]/90" />
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

      <Link
        href={backHref}
        className="relative z-10 mt-5 inline-flex items-center gap-1 text-[11px] font-medium text-white/65"
      >
        <ChevronLeft aria-hidden size={14} />
        {backLabel}
      </Link>

      <h1 className="relative z-10 mt-2 truncate text-[20px] font-semibold tracking-tight">
        {title}
      </h1>
    </section>
  );
}
