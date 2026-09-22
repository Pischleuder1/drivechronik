import Image from "next/image";
import { CloudOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { APP_TIMEZONE } from "../../lib/config";
import type { WeatherResult } from "../../lib/weather";
import { weatherCodeIcon, weatherCodeKey } from "../../lib/weatherCodes";
import { DashboardClock } from "./DashboardClock";

export async function DashboardHero({
  weather,
}: {
  weather: WeatherResult | null;
}) {
  const [t, tWeather] = await Promise.all([
    getTranslations("dashboard.hero"),
    getTranslations("weather"),
  ]);

  const WeatherIcon = weather
    ? weatherCodeIcon(weather.weatherCode)
    : CloudOff;

  return (
    <section className="relative min-h-[145px] overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-white to-sky-50/60 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-900 dark:to-sky-950/20">
      <Image
        src="/visuals/vehicle-tesla-header.png"
        alt=""
        width={2172}
        height={724}
        priority
        className="pointer-events-none absolute right-0 top-1/2 h-full w-auto -translate-y-1/2 object-contain opacity-75 dark:opacity-40"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/10 dark:from-neutral-900 dark:via-neutral-900/95 dark:to-neutral-900/10"
      />

      <div className="relative z-10 flex min-h-[145px] max-w-2xl flex-col justify-center px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {t("eyebrow")}
        </p>

        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl">
          {t("title")}
        </h1>

        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {t("subtitle")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <WeatherIcon
              aria-hidden
              size={17}
              strokeWidth={1.8}
              className="text-blue-600 dark:text-blue-300"
            />

            {weather ? (
              <>
                <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                  {Math.round(weather.temperature)}°
                </span>

                <span className="text-neutral-500 dark:text-neutral-400">
                  {tWeather(
                    `code.${weatherCodeKey(weather.weatherCode)}`,
                  )}
                </span>
              </>
            ) : (
              <span className="text-neutral-500 dark:text-neutral-400">
                {tWeather("unavailable")}
              </span>
            )}
          </span>

          <span
            aria-hidden
            className="hidden h-4 w-px bg-neutral-200 dark:bg-neutral-700 sm:block"
          />

          <DashboardClock timeZone={APP_TIMEZONE} />
        </div>
      </div>
    </section>
  );
}
