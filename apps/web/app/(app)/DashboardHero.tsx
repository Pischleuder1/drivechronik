import { CloudOff } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

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

  const locale = await getLocale();

  const WeatherIcon = weather
    ? weatherCodeIcon(weather.weatherCode)
    : CloudOff;

  return (
    <section className="relative bg-transparent dark:bg-transparent">
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8 px-1 py-3 lg:py-2">
        <div className="min-w-0">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {locale === "en" ? "Overview" : "Übersicht"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 lg:text-3xl">
          {locale === "en" ? "Good day!" : "Guten Tag!"}
        </h1>

        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {t("subtitle")}
        </p>

        </div>
        <div className="flex shrink-0 flex-wrap items-center lg:justify-end gap-x-4 gap-y-2 text-sm">
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
