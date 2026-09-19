"use client";

import { useMemo, useState } from "react";

export interface ComparisonCurvePoint {
  ts: number;
  powerKw: number | null;
  soc: number | null;
  outsideTemp: number | null;
}

export interface ComparisonCurve {
  id: number;
  startTime: number;
  label: string;
  points: ComparisonCurvePoint[];
}

interface Props {
  curves: ComparisonCurve[];
}

type InterpolatedPoint = {
  soc: number;
  powerKw: number;
};

function interpolateCurve(
  points: ComparisonCurvePoint[],
): InterpolatedPoint[] {
  const valid = points
    .filter(
      (p): p is ComparisonCurvePoint & { soc: number; powerKw: number } =>
        p.soc != null &&
        p.powerKw != null &&
        Number.isFinite(p.soc) &&
        Number.isFinite(p.powerKw),
    )
    .sort((a, b) => a.soc - b.soc);

  if (valid.length < 2) return [];

  // Gleiche SoC-Werte zusammenfassen.
  const bySoc = new Map<number, number[]>();

  for (const p of valid) {
    const soc = Math.max(0, Math.min(100, p.soc));
    const list = bySoc.get(soc) ?? [];
    list.push(p.powerKw);
    bySoc.set(soc, list);
  }

  const source = [...bySoc.entries()]
    .map(([soc, values]) => ({
      soc,
      powerKw: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.soc - b.soc);

  if (source.length < 2) return [];

  const minSoc = Math.ceil(source[0]!.soc);
  const maxSoc = Math.floor(source[source.length - 1]!.soc);

  const result: InterpolatedPoint[] = [];

  for (let soc = minSoc; soc <= maxSoc; soc += 1) {
    let left: (typeof source)[number] | undefined;
    let right: (typeof source)[number] | undefined;

    for (let i = 0; i < source.length - 1; i += 1) {
      const a = source[i]!;
      const b = source[i + 1]!;

      if (soc >= a.soc && soc <= b.soc) {
        left = a;
        right = b;
        break;
      }
    }

    if (!left || !right) continue;

    const span = right.soc - left.soc;

    if (span === 0) {
      result.push({ soc, powerKw: left.powerKw });
      continue;
    }

    const factor = (soc - left.soc) / span;

    result.push({
      soc,
      powerKw:
        left.powerKw + (right.powerKw - left.powerKw) * factor,
    });
  }

  return result;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(ts));
}

export function ChargeCurveComparison({ curves }: Props) {
  const [limit, setLimit] = useState<5 | 10>(5);

  const visibleCurves = useMemo(
    () => curves.slice(0, limit),
    [curves, limit],
  );

  const prepared = useMemo(
    () =>
      visibleCurves
        .map((curve) => ({
          ...curve,
          interpolated: interpolateCurve(curve.points),
        }))
        .filter((curve) => curve.interpolated.length >= 2),
    [visibleCurves],
  );

  const medianCurve = useMemo(() => {
    const result: InterpolatedPoint[] = [];

    for (let soc = 0; soc <= 100; soc += 1) {
      const values = prepared
        .map((curve) =>
          curve.interpolated.find((point) => point.soc === soc)?.powerKw,
        )
        .filter((value): value is number => value != null);

      // Median erst anzeigen, wenn mindestens zwei Kurven
      // an diesem SoC Messwerte liefern.
      if (values.length < 2) continue;

      const value = median(values);
      if (value != null) result.push({ soc, powerKw: value });
    }

    return result;
  }, [prepared]);

  if (curves.length === 0) return null;

  const allPowerValues = [
    ...prepared.flatMap((curve) =>
      curve.interpolated.map((point) => point.powerKw),
    ),
    ...medianCurve.map((point) => point.powerKw),
  ];

  if (allPowerValues.length === 0) return null;

  const maxPower =
    Math.max(20, Math.ceil(Math.max(...allPowerValues) / 20) * 20);

  const width = 1000;
  const height = 330;
  const margin = {
    top: 22,
    right: 28,
    bottom: 42,
    left: 58,
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const x = (soc: number) =>
    margin.left + (Math.max(0, Math.min(100, soc)) / 100) * plotWidth;

  const y = (powerKw: number) =>
    margin.top +
    plotHeight -
    (Math.max(0, powerKw) / maxPower) * plotHeight;

  const pathFor = (points: InterpolatedPoint[]) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${x(point.soc).toFixed(2)} ${y(
            point.powerKw,
          ).toFixed(2)}`,
      )
      .join(" ");

  const gridPowers = [0, maxPower / 4, maxPower / 2, (maxPower * 3) / 4, maxPower];
  const socTicks = [0, 20, 40, 60, 80, 100];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5 dark:border-neutral-800">
        <div>
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            DC-Ladekurvenvergleich
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Leistung über SoC der letzten abgeschlossenen DC-Ladevorgänge · unabhängig vom Monatsfilter
          </p>
        </div>

        <div className="flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setLimit(5)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              limit === 5
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Letzte 5
          </button>

          <button
            type="button"
            onClick={() => setLimit(10)}
            disabled={curves.length <= 5}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              limit === 10
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Letzte 10
          </button>
        </div>
      </div>

      <div className="px-3 py-4 sm:px-5">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[720px] w-full"
            role="img"
            aria-label="Vergleich der DC-Ladekurven nach Ladezustand"
          >
            {gridPowers.map((power) => (
              <g key={power}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y(power)}
                  y2={y(power)}
                  className="stroke-neutral-200 dark:stroke-neutral-800"
                  strokeDasharray="4 4"
                />
                <text
                  x={margin.left - 10}
                  y={y(power) + 4}
                  textAnchor="end"
                  className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
                >
                  {Math.round(power)} kW
                </text>
              </g>
            ))}

            {socTicks.map((soc) => (
              <g key={soc}>
                <line
                  x1={x(soc)}
                  x2={x(soc)}
                  y1={margin.top}
                  y2={height - margin.bottom}
                  className="stroke-neutral-100 dark:stroke-neutral-800/70"
                />
                <text
                  x={x(soc)}
                  y={height - 14}
                  textAnchor="middle"
                  className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
                >
                  {soc} %
                </text>
              </g>
            ))}

            {prepared.map((curve, index) => (
              <path
                key={curve.id}
                d={pathFor(curve.interpolated)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={[
                  "text-sky-500",
                  "text-violet-500",
                  "text-emerald-500",
                  "text-amber-500",
                  "text-cyan-500",
                  "text-fuchsia-500",
                  "text-lime-600",
                  "text-orange-500",
                  "text-indigo-500",
                  "text-rose-500",
                ][index % 10]}
                opacity="0.72"
              />
            ))}

            {medianCurve.length >= 2 && (
              <path
                d={pathFor(medianCurve)}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-900 dark:text-white"
              />
            )}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {prepared.map((curve, index) => (
            <div
              key={curve.id}
              className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300"
            >
              <span
                className={[
                  "h-0.5 w-5 bg-sky-500",
                  "h-0.5 w-5 bg-violet-500",
                  "h-0.5 w-5 bg-emerald-500",
                  "h-0.5 w-5 bg-amber-500",
                  "h-0.5 w-5 bg-cyan-500",
                  "h-0.5 w-5 bg-fuchsia-500",
                  "h-0.5 w-5 bg-lime-600",
                  "h-0.5 w-5 bg-orange-500",
                  "h-0.5 w-5 bg-indigo-500",
                  "h-0.5 w-5 bg-rose-500",
                ][index % 10]}
              />
              <span>
                {formatDate(curve.startTime)} · {curve.label}
              </span>
            </div>
          ))}

          {medianCurve.length >= 2 && (
            <div className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
              <span className="h-1 w-5 bg-neutral-900 dark:bg-white" />
              Median
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Kurven beginnen und enden nur dort, wo für den jeweiligen
          Ladevorgang TeslaMate-Messwerte vorliegen. Fehlende SoC-Bereiche
          werden nicht extrapoliert.
        </p>
      </div>
    </section>
  );
}
