import { Activity, BarChart3 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { DashboardWeekDay } from "../../lib/dashboard";
import { APP_TIMEZONE } from "../../lib/config";

const WIDTH = 480;
const HEIGHT = 160;
const LEFT = 42;
const RIGHT = 16;
const TOP = 18;
const BOTTOM = 30;
const INNER_W = WIDTH - LEFT - RIGHT;
const INNER_H = HEIGHT - TOP - BOTTOM;

function niceMax(value: number): number {
  if (value <= 10) return 10;
  if (value <= 25) return 25;
  if (value <= 50) return 50;
  if (value <= 100) return 100;
  return Math.ceil(value / 50) * 50;
}

export async function DashboardWeekCharts({
  data,
}: {
  data: DashboardWeekDay[];
}) {
  const [t, locale] = await Promise.all([
    getTranslations("dashboard.weekCharts"),
    getLocale(),
  ]);

  const labelFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: APP_TIMEZONE,
  });

  const labels = data.map((day) => {
    const [y, m, d] = day.date.split("-").map(Number);
    return labelFormatter.format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
  });

  const distances = data.map((day) => day.distanceKm);
  const distanceMax = niceMax(Math.max(...distances, 1));

  const consumption = data.map((day) =>
    day.avgConsumptionWhKm != null
      ? day.avgConsumptionWhKm / 10
      : null,
  );

  const consumptionValues = consumption.filter(
    (v): v is number => v != null,
  );

  const rawMin =
    consumptionValues.length > 0 ? Math.min(...consumptionValues) : 10;
  const rawMax =
    consumptionValues.length > 0 ? Math.max(...consumptionValues) : 25;

  const consumptionMin = Math.max(0, Math.floor((rawMin - 2) / 5) * 5);
  const consumptionMax = Math.max(
    consumptionMin + 5,
    Math.ceil((rawMax + 2) / 5) * 5,
  );
  const consumptionRange = consumptionMax - consumptionMin;

  const totalConsumptionDistance = data.reduce(
    (sum, day) =>
      sum +
      (day.avgConsumptionWhKm != null ? day.distanceKm : 0),
    0,
  );

  const weightedConsumption =
    totalConsumptionDistance > 0
      ? data.reduce(
          (sum, day) =>
            sum +
            (day.avgConsumptionWhKm != null
              ? day.distanceKm * day.avgConsumptionWhKm
              : 0),
          0,
        ) /
        totalConsumptionDistance /
        10
      : null;

  const slot = INNER_W / 7;
  const barWidth = Math.min(slot * 0.46, 30);

  const xFor = (i: number) => LEFT + slot * i + slot / 2;

  const distanceY = (km: number) =>
    TOP + INNER_H - (km / distanceMax) * INNER_H;

  const consumptionY = (value: number) =>
    TOP +
    INNER_H -
    ((value - consumptionMin) / consumptionRange) * INNER_H;

  const linePoints = consumption
    .map((value, i) =>
      value != null
        ? `${xFor(i).toFixed(1)},${consumptionY(value).toFixed(1)}`
        : null,
    )
    .filter((v): v is string => v != null)
    .join(" ");

  const card =
    "rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3
              aria-hidden
              size={17}
              className="text-blue-600 dark:text-blue-400"
            />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("distanceTitle")}
            </h2>
          </div>

          <span className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {t("thisWeek")}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-2 h-40 w-full"
          role="img"
          aria-label={t("distanceAria")}
        >
          {[0, 0.5, 1].map((f) => {
            const y = TOP + INNER_H - INNER_H * f;
            const value = distanceMax * f;

            return (
              <g key={f}>
                <line
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-100 dark:stroke-neutral-800"
                />
                <text
                  x={LEFT - 7}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          {distances.map((value, i) => {
            const y = distanceY(value);

            return (
              <rect
                key={data[i]!.date}
                x={xFor(i) - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(0, TOP + INNER_H - y)}
                rx={3}
                className="fill-blue-500/25 dark:fill-blue-400/30"
              />
            );
          })}

          {labels.map((label, i) => (
            <text
              key={data[i]!.date}
              x={xFor(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
            >
              {label}
            </text>
          ))}

          <text
            x={4}
            y={TOP - 5}
            className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
          >
            km
          </text>
        </svg>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity
              aria-hidden
              size={17}
              className="text-blue-600 dark:text-blue-400"
            />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("consumptionTitle")}
            </h2>
          </div>

          <span className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {t("thisWeek")}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-2 h-40 w-full"
          role="img"
          aria-label={t("consumptionAria")}
        >
          {[0, 0.5, 1].map((f) => {
            const y = TOP + INNER_H - INNER_H * f;
            const value =
              consumptionMin + consumptionRange * f;

            return (
              <g key={f}>
                <line
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-100 dark:stroke-neutral-800"
                />
                <text
                  x={LEFT - 7}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          {linePoints && (
            <polyline
              points={linePoints}
              fill="none"
              className="stroke-blue-500 dark:stroke-blue-400"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {consumption.map((value, i) =>
            value != null ? (
              <circle
                key={data[i]!.date}
                cx={xFor(i)}
                cy={consumptionY(value)}
                r={3}
                className="fill-blue-500 dark:fill-blue-400"
              />
            ) : null,
          )}

          {labels.map((label, i) => (
            <text
              key={data[i]!.date}
              x={xFor(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
            >
              {label}
            </text>
          ))}
        </svg>

        <div className="mt-1 flex items-center justify-between gap-3 text-xs">
          <span className="text-neutral-400 dark:text-neutral-500">
            kWh/100 km
          </span>

          <span className="font-medium tabular-nums text-neutral-600 dark:text-neutral-300">
            {weightedConsumption != null
              ? t("average", {
                  value: weightedConsumption.toLocaleString(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })
              : t("noConsumption")}
          </span>
        </div>
      </section>
    </div>
  );
}
