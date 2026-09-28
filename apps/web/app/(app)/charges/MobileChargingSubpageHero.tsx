import Link from "next/link";
import { ChevronLeft, Zap } from "lucide-react";

import { ActiveVehicleSwitcher } from "../../../components/ActiveVehicleSwitcher";

interface VehicleOption {
  id: number;
  displayName: string;
}

export function MobileChargingSubpageHero({
  vehicles,
  initialVehicleId,
  title,
  subtitle,
  backLabel,
  children,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number | null;
  title: string;
  subtitle: string;
  backLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative -mx-4 -mt-4 min-h-[178px] overflow-hidden bg-[#071421] px-4 pb-4 pt-4 text-white md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 420 178"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="chargingSubBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2440" />
              <stop offset="1" stopColor="#071421" />
            </linearGradient>

            <linearGradient id="chargingSubLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#67e8f9" />
            </linearGradient>
          </defs>

          <rect width="420" height="178" fill="url(#chargingSubBg)" />

          <g
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.1"
          >
            <path d="M-20 35 C58 10 121 47 194 31 S330 20 445 42" />
            <path d="M-20 108 C68 77 131 119 213 95 S345 82 445 111" />
            <path d="M71 -20 C88 44 54 108 79 195" />
            <path d="M194 -20 C166 46 208 112 185 195" />
            <path d="M317 -20 C290 44 331 111 306 195" />
          </g>

          <path
            d="M31 145 C74 131 107 136 144 109 C177 85 201 96 232 75 C264 53 296 72 328 55 C355 40 382 42 408 28"
            fill="none"
            stroke="#020617"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.35"
          />

          <path
            d="M31 145 C74 131 107 136 144 109 C177 85 201 96 232 75 C264 53 296 72 328 55 C355 40 382 42 408 28"
            fill="none"
            stroke="url(#chargingSubLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g
            fill="none"
            stroke="#7dd3fc"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.28"
          >
            <rect x="286" y="39" width="56" height="49" rx="10" strokeWidth="3" />
            <path d="M318 28l-21 35h18l-8 29 29-44h-20z" strokeWidth="4" />
          </g>
        </svg>

        <div className="absolute inset-0 bg-gradient-to-b from-[#05101d]/10 via-transparent to-[#071421]/95" />
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
        href="/charges"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-sky-200/80"
      >
        <ChevronLeft aria-hidden size={14} />
        {backLabel}
      </Link>

      <div className="relative z-10 mt-2.5">
        <div className="flex items-center gap-2">
          <Zap aria-hidden size={15} className="shrink-0 text-sky-300" />

          <h1 className="text-[17px] font-semibold tracking-tight">
            {title}
          </h1>
        </div>

        <p className="mt-1 max-w-[330px] text-[12px] leading-relaxed text-slate-300">
          {subtitle}
        </p>

        {children && <div className="mt-3">{children}</div>}
      </div>
    </section>
  );
}
