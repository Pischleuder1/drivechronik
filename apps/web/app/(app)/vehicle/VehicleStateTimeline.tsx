import { Activity } from "lucide-react";

import { Panel } from "../../../components/ui/Panel";
import type {
  VehicleStateTimelineResult,
} from "../../../lib/vehicleStateTimeline";
import type {
  VehicleStatusKind,
} from "../../../lib/vehicleStateTimelineLogic";

const BAR_CLASS: Record<VehicleStatusKind, string> = {
  asleep: "bg-slate-400/45 dark:bg-slate-500/55",
  online: "bg-sky-500 dark:bg-sky-400",
  offline: "bg-neutral-400 dark:bg-neutral-500",
  driving: "bg-blue-800 dark:bg-blue-600",
  charging: "bg-green-700 dark:bg-green-500",
};

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours > 0) {
    return `${hours} h ${rest} min`;
  }

  return `${rest} min`;
}

function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(
    new Date(Date.UTC(year!, month! - 1, day!, 12)),
  );
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function VehicleStateTimeline({
  timeline,
  labels,
}: {
  timeline: VehicleStateTimelineResult;
  labels: {
    title: string;
    subtitle: string;
    sleepShare: string;
    sleepTime: string;
    onlineTime: string;
    coverage: string;
    asleep: string;
    online: string;
    offline: string;
    driving: string;
    charging: string;
    sleep: string;
    empty: string;
    hint: string;
    lowCoverage: string;
  };
}) {
  const hasData = timeline.trackedSeconds > 0;

  const labelByKind: Record<VehicleStatusKind, string> = {
    asleep: labels.asleep,
    online: labels.online,
    offline: labels.offline,
    driving: labels.driving,
    charging: labels.charging,
  };

  return (
    <Panel className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity
              aria-hidden
              size={17}
              className="text-slate-400 dark:text-slate-500"
            />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {labels.title}
            </h2>
          </div>

          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {labels.subtitle}
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          {labels.empty}
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary
              label={labels.sleepShare}
              value={
                timeline.sleepSharePercent != null
                  ? `${Math.round(
                      timeline.sleepSharePercent,
                    )} %`
                  : "—"
              }
            />
            <Summary
              label={labels.sleepTime}
              value={formatDuration(
                timeline.totals.asleep,
              )}
            />
            <Summary
              label={labels.onlineTime}
              value={formatDuration(
                timeline.totals.online,
              )}
            />
            <Summary
              label={labels.coverage}
              value={`${Math.round(
                timeline.coveragePercent,
              )} %`}
            />
          </div>

          {timeline.coveragePercent < 50 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              {labels.lowCoverage}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
            {(
              [
                "asleep",
                "online",
                "offline",
                "driving",
                "charging",
              ] as VehicleStatusKind[]
            ).map((kind) => (
              <span
                key={kind}
                className="inline-flex items-center gap-1.5"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${BAR_CLASS[kind]}`}
                  aria-hidden
                />
                {labelByKind[kind]}
              </span>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[88px_minmax(0,1fr)_54px] items-end gap-3 pb-2 text-[10px] text-neutral-400">
                <span />
                <div className="grid grid-cols-5">
                  <span>00</span>
                  <span className="text-center">
                    06
                  </span>
                  <span className="text-center">
                    12
                  </span>
                  <span className="text-center">
                    18
                  </span>
                  <span className="text-right">
                    24
                  </span>
                </div>
                <span className="text-right">
                  {labels.sleep}
                </span>
              </div>

              <div className="space-y-2">
                {[...timeline.days]
                  .reverse()
                  .map((day) => {
                    const dayMs =
                      day.endTime.getTime() -
                      day.startTime.getTime();

                    const stateTrackedSeconds =
                      day.totals.asleep +
                      day.totals.online +
                      day.totals.offline;

                    const trackedSeconds =
                      Object.values(day.totals).reduce(
                        (sum, seconds) =>
                          sum + seconds,
                        0,
                      );

                    const sleepShare =
                      stateTrackedSeconds > 0 &&
                      trackedSeconds > 0
                        ? Math.round(
                            (day.totals.asleep /
                              trackedSeconds) *
                              100,
                          )
                        : null;

                    return (
                      <div
                        key={day.dateKey}
                        className="grid grid-cols-[88px_minmax(0,1fr)_54px] items-center gap-3"
                      >
                        <div className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                          {formatDay(
                            day.dateKey,
                          )}
                        </div>

                        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                          {day.segments.map(
                            (segment, index) => {
                              const left =
                                ((segment.startTime.getTime() -
                                  day.startTime.getTime()) /
                                  dayMs) *
                                100;

                              const width =
                                ((segment.endTime.getTime() -
                                  segment.startTime.getTime()) /
                                  dayMs) *
                                100;

                              return (
                                <span
                                  key={`${segment.kind}-${segment.startTime.getTime()}-${index}`}
                                  className={`absolute inset-y-0 ${BAR_CLASS[segment.kind]}`}
                                  style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                  }}
                                  title={`${labelByKind[segment.kind]} · ${formatClock(segment.startTime)}–${formatClock(segment.endTime)}`}
                                />
                              );
                            },
                          )}
                        </div>

                        <div className="text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                          {sleepShare != null
                            ? `${sleepShare} %`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
              </div>
          </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {labels.hint}
          </p>
        </>
      )}
    </Panel>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
    </div>
  );
}
