"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Tire = "fl" | "fr" | "rl" | "rr";

interface Point {
  ts: string;
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}

interface Alert {
  tire: Tire;
  dropBar: number;
  peerDifferenceBar: number;
  sampleDays: number;
  spanDays: number;
  severity: "noticeable" | "strong";
}

const TIRES = [
  {
    key: "fl" as const,
    stroke: "stroke-blue-500",
    dot: "bg-blue-500",
  },
  {
    key: "fr" as const,
    stroke: "stroke-sky-400",
    dot: "bg-sky-400",
  },
  {
    key: "rl" as const,
    stroke: "stroke-amber-500",
    dot: "bg-amber-500",
  },
  {
    key: "rr" as const,
    stroke: "stroke-emerald-500",
    dot: "bg-emerald-500",
  },
];

const OVERVIEW_WIDTH = 720;
const OVERVIEW_HEIGHT = 220;
const SMALL_WIDTH = 360;
const SMALL_HEIGHT = 150;

const LEFT = 38;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 28;

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function peerMedian(
  point: Point,
  tire: Tire,
): number | null {
  const tires: Tire[] = ["fl", "fr", "rl", "rr"];

  return median(
    tires
      .filter((candidate) => candidate !== tire)
      .map((candidate) => point[candidate])
      .filter((value): value is number => value != null),
  );
}

function overallMedian(point: Point): number | null {
  return median(
    ([point.fl, point.fr, point.rl, point.rr]).filter(
      (value): value is number => value != null,
    ),
  );
}

function pathPoints(
  points: Point[],
  getter: (point: Point) => number | null,
  toX: (ts: string) => number,
  toY: (value: number) => number,
): string {
  return points
    .map((point) => {
      const value = getter(point);

      return value == null
        ? null
        : `${toX(point.ts).toFixed(1)},${toY(value).toFixed(1)}`;
    })
    .filter((value): value is string => value != null)
    .join(" ");
}

export function TpmsHistory({
  history,
  alerts30,
  alerts90,
}: {
  history: Point[];
  alerts30: Alert[];
  alerts90: Alert[];
}) {
  const t = useTranslations("vehicle.tpmsHistory");
  const [days, setDays] = useState<30 | 90>(30);

  const filtered = useMemo(() => {
    if (history.length === 0) return [];

    const latest = Math.max(
      ...history.map((point) => new Date(point.ts).getTime()),
    );

    const start =
      latest - days * 24 * 60 * 60 * 1000;

    return history.filter(
      (point) => new Date(point.ts).getTime() >= start,
    );
  }, [history, days]);

  const alerts = days === 30 ? alerts30 : alerts90;
  const latest = filtered.at(-1) ?? null;

  const scale = useMemo(() => {
    if (filtered.length < 2) return null;

    const values: number[] = [];

    for (const point of filtered) {
      for (const tire of TIRES) {
        const value = point[tire.key];

        if (value != null) {
          values.push(value);
        }

        const peer = peerMedian(point, tire.key);

        if (peer != null) {
          values.push(peer);
        }
      }

      const total = overallMedian(point);

      if (total != null) {
        values.push(total);
      }
    }

    if (values.length === 0) return null;

    let minValue =
      Math.floor((Math.min(...values) - 0.08) * 10) / 10;

    let maxValue =
      Math.ceil((Math.max(...values) + 0.08) * 10) / 10;

    if (maxValue - minValue < 0.4) {
      const center = (maxValue + minValue) / 2;
      minValue = center - 0.2;
      maxValue = center + 0.2;
    }

    return {
      minValue,
      maxValue,
      middleValue: (minValue + maxValue) / 2,
    };
  }, [filtered]);

  function chartGeometry(
    width: number,
    height: number,
  ) {
    if (!scale || filtered.length < 2) return null;

    const times = filtered.map((point) =>
      new Date(point.ts).getTime(),
    );

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const innerWidth = width - LEFT - RIGHT;
    const innerHeight = height - TOP - BOTTOM;

    const toX = (ts: string) => {
      const value = new Date(ts).getTime();

      if (maxTime === minTime) {
        return LEFT + innerWidth / 2;
      }

      return (
        LEFT +
        ((value - minTime) / (maxTime - minTime)) *
          innerWidth
      );
    };

    const toY = (value: number) =>
      TOP +
      ((scale.maxValue - value) /
        (scale.maxValue - scale.minValue)) *
        innerHeight;

    return {
      toX,
      toY,
      innerHeight,
    };
  }

  const smallGeometry = chartGeometry(
    SMALL_WIDTH,
    SMALL_HEIGHT,
  );

  const overviewGeometry = chartGeometry(
    OVERVIEW_WIDTH,
    OVERVIEW_HEIGHT,
  );

  const yTicks = scale
    ? [
        scale.maxValue,
        scale.middleValue,
        scale.minValue,
      ]
    : [];

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("title")}
          </h2>

          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
          {([30, 90] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                days === value
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              {t("days", { count: value })}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t("empty")}
        </p>
      ) : (
        <>
          {latest && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIRES.map((tire) => (
                <div
                  key={tire.key}
                  className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${tire.dot}`}
                    />

                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t(`tire.${tire.key}`)}
                    </span>
                  </div>

                  <p className="mt-1 font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {latest[tire.key] != null
                      ? `${latest[tire.key]!.toFixed(2)} bar`
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {scale && smallGeometry ? (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-5 bg-neutral-700 dark:bg-neutral-300" />
                  {t("legendMeasured")}
                </span>

                <span className="flex items-center gap-2">
                  <svg
                    width="20"
                    height="4"
                    aria-hidden
                  >
                    <line
                      x1="0"
                      y1="2"
                      x2="20"
                      y2="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  </svg>
                  {t("legendPeer")}
                </span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {TIRES.map((tire) => {
                  const ownPoints = pathPoints(
                    filtered,
                    (point) => point[tire.key],
                    smallGeometry.toX,
                    smallGeometry.toY,
                  );

                  const peerPoints = pathPoints(
                    filtered,
                    (point) =>
                      peerMedian(point, tire.key),
                    smallGeometry.toX,
                    smallGeometry.toY,
                  );

                  return (
                    <div
                      key={tire.key}
                      className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${tire.dot}`}
                          />

                          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {t(`tire.${tire.key}`)}
                          </h3>
                        </div>

                        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                          {latest?.[tire.key] != null
                            ? `${latest[tire.key]!.toFixed(2)} bar`
                            : "—"}
                        </span>
                      </div>

                      <svg
                        viewBox={`0 0 ${SMALL_WIDTH} ${SMALL_HEIGHT}`}
                        role="img"
                        aria-label={t("singleChartAria", {
                          tire: t(`tire.${tire.key}`),
                        })}
                        className="mt-2 h-auto w-full"
                      >
                        {yTicks.map((value) => {
                          const y =
                            smallGeometry.toY(value);

                          return (
                            <g key={value}>
                              <line
                                x1={LEFT}
                                x2={SMALL_WIDTH - RIGHT}
                                y1={y}
                                y2={y}
                                className="stroke-neutral-200 dark:stroke-neutral-800"
                              />

                              <text
                                x={LEFT - 6}
                                y={y + 4}
                                textAnchor="end"
                                className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
                              >
                                {value.toFixed(1)}
                              </text>
                            </g>
                          );
                        })}

                        <polyline
                          points={peerPoints}
                          fill="none"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="4 4"
                          className="stroke-neutral-400 dark:stroke-neutral-500"
                        />

                        <polyline
                          points={ownPoints}
                          fill="none"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={tire.stroke}
                        />
                      </svg>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {t("overview")}
                  </h3>

                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("overviewHint")}
                  </span>
                </div>

                {overviewGeometry && (
                  <svg
                    viewBox={`0 0 ${OVERVIEW_WIDTH} ${OVERVIEW_HEIGHT}`}
                    role="img"
                    aria-label={t("chartAria")}
                    className="mt-2 h-auto w-full"
                  >
                    {yTicks.map((value) => {
                      const y =
                        overviewGeometry.toY(value);

                      return (
                        <g key={value}>
                          <line
                            x1={LEFT}
                            x2={OVERVIEW_WIDTH - RIGHT}
                            y1={y}
                            y2={y}
                            className="stroke-neutral-200 dark:stroke-neutral-800"
                          />

                          <text
                            x={LEFT - 7}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
                          >
                            {value.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    <polyline
                      points={pathPoints(
                        filtered,
                        overallMedian,
                        overviewGeometry.toX,
                        overviewGeometry.toY,
                      )}
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 5"
                      className="stroke-neutral-500 dark:stroke-neutral-400"
                    />

                    {TIRES.map((tire) => (
                      <polyline
                        key={tire.key}
                        points={pathPoints(
                          filtered,
                          (point) =>
                            point[tire.key],
                          overviewGeometry.toX,
                          overviewGeometry.toY,
                        )}
                        fill="none"
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={tire.stroke}
                      />
                    ))}

                    <text
                      x={LEFT}
                      y={OVERVIEW_HEIGHT - 7}
                      className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
                    >
                      {new Date(
                        filtered[0]!.ts,
                      ).toLocaleDateString()}
                    </text>

                    <text
                      x={OVERVIEW_WIDTH - RIGHT}
                      y={OVERVIEW_HEIGHT - 7}
                      textAnchor="end"
                      className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
                    >
                      {new Date(
                        filtered.at(-1)!.ts,
                      ).toLocaleDateString()}
                    </text>
                  </svg>
                )}

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {TIRES.map((tire) => (
                    <div
                      key={tire.key}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
                    >
                      <span
                        className={`h-0.5 w-3 ${tire.dot}`}
                      />
                      {t(`tire.${tire.key}`)}
                    </div>
                  ))}

                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <svg
                      width="14"
                      height="4"
                      aria-hidden
                    >
                      <line
                        x1="0"
                        y1="2"
                        x2="14"
                        y2="2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                    </svg>
                    {t("overallMedian")}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              {t("notEnough")}
            </p>
          )}

          <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {alerts.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {t("noAlert")}
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.tire}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/20"
                  >
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {t("possibleLeak")}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      {t("alertText", {
                        tire: t(
                          `tire.${alert.tire}`,
                        ),
                        drop: alert.dropBar.toFixed(2),
                        gap: Math.abs(
                          alert.peerDifferenceBar,
                        ).toFixed(2),
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {t("method")}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
