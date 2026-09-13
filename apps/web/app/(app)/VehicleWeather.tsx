import { Wind } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { WeatherResult } from "../../lib/weather";
import { weatherCodeIcon, weatherCodeKey } from "../../lib/weatherCodes";
import { IconBadge } from "../../components/ui/IconBadge";

function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

export async function VehicleWeather({
  weather,
}: {
  weather: WeatherResult | null;
}) {
  if (!weather) return null;

  const t = await getTranslations("weather");
  const Icon = weatherCodeIcon(weather.weatherCode);
  const showColdHint = weather.apparentTemperature < 5;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-neutral-50/80 px-3 py-2.5 dark:bg-neutral-800/50">
      <div className="flex items-center gap-2.5">
        <IconBadge tone={showColdHint ? "cyan" : "amber"} size="sm">
          <Icon aria-hidden size={18} strokeWidth={1.7} />
        </IconBadge>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums text-neutral-950 dark:text-neutral-50">
              {formatTemp(weather.temperature)}
            </span>

            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t(`code.${weatherCodeKey(weather.weatherCode)}`)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("feelsLike", {
          temp: formatTemp(weather.apparentTemperature),
        })}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Wind aria-hidden size={13} />
        {Math.round(weather.windSpeedKmh)} km/h
      </div>

      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {t("todayRange", {
          min: formatTemp(weather.todayMin),
          max: formatTemp(weather.todayMax),
        })}
      </div>
    </div>
  );
}
