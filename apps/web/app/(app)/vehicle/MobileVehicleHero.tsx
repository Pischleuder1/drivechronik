import Image from "next/image";
import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

function vehicleImage(model: string | null): string | null {
  if (model === "Y") return "/vehicles/modely-side.webp";
  if (model === "3") return "/vehicles/model3-side.webp";
  return null;
}

export function MobileVehicleHero({
  vehicles,
  initialVehicleId,
  displayName,
  model,
  pageTitle,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
  displayName: string;
  model: string | null;
  pageTitle: string;
}) {
  const image = vehicleImage(model);

  return (
    <section className="relative -mx-4 -mt-4 h-[190px] overflow-hidden bg-[#071421] px-4 pt-4 text-white md:hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <svg
          viewBox="0 0 420 190"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="vehicleHeroBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="vehicleHeroGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#22c55e" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect width="420" height="190" fill="url(#vehicleHeroBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.10"
          >
            <path d="M-20 42 C67 17 125 56 205 34 S340 26 450 47" />
            <path d="M-20 105 C72 78 137 118 221 94 S343 83 450 111" />
            <path d="M70 -20 C89 46 54 108 81 215" />
            <path d="M205 -20 C179 51 222 116 199 215" />
            <path d="M340 -20 C310 44 353 118 327 215" />
          </g>

          <path
            d="M30 151 C84 140 116 146 162 130 C214 112 267 127 318 111 C351 101 376 96 403 93"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M30 151 C84 140 116 146 162 130 C214 112 267 127 318 111 C351 101 376 96 403 93"
            fill="none"
            stroke="url(#vehicleHeroGlow)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#071421]/95" />
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
        ) : (
          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
            {displayName}
          </span>
        )}
      </div>

      <p className="relative z-10 mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
        {pageTitle}
      </p>

      {image && (
        <div className="absolute bottom-3 left-1/2 z-10 h-[72px] w-[250px] -translate-x-1/2">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="250px"
            className="object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.35)]"
          />
        </div>
      )}
    </section>
  );
}
