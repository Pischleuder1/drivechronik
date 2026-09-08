import { CloudOff, Wind } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { weatherCodeIcon, weatherCodeKey } from "../../lib/weatherCodes";
import type { WeatherResult } from "../../lib/weather";

function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

export async function WeatherCard({
  weather,
}: {
  weather: WeatherResult | null;
}) {
  const t = await getTranslations("weather");

  if (!weather) {
    return (
      <section className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <CloudOff aria-hidden size={20} />
          </div>
          <p className="text-sm">{t("unavailable")}</p>
        </div>
      </section>
    );
  }

  const Icon = weatherCodeIcon(weather.weatherCode);
  const showColdHint = weather.apparentTemperature < 5;

  return (
    <section className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            <Icon aria-hidden size={27} strokeWidth={1.7} />
          </div>

          <div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
              {formatTemp(weather.temperature)}
            </p>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              {t(`code.${weatherCodeKey(weather.weatherCode)}`)}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
          <p>
            {t("feelsLike", {
              temp: formatTemp(weather.apparentTemperature),
            })}
          </p>
          <p className="mt-2 flex items-center justify-end gap-1.5">
            <Wind aria-hidden size={13} />
            {Math.round(weather.windSpeedKmh)} km/h
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("todayRange", {
            min: formatTemp(weather.todayMin),
            max: formatTemp(weather.todayMax),
          })}
        </p>

        {showColdHint && (
          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            {t("coldHint")}
          </p>
        )}
      </div>
    </section>
  );
}
