import Link from "next/link";
import { Plus, Route, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatKm } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../lib/config";
import { getActiveVehicleId } from "../../../lib/activeVehicle";
import { getVehicles } from "../../../lib/queries";
import { getJourneys } from "../../../lib/journeys";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { NoVehicleState } from "../../../components/NoVehicleState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { MobileJourneysHero } from "./MobileJourneysHero";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

function formatRange(start: Date, end: Date): string {
  return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
}

export default async function JourneysPage() {
  const t = await getTranslations("journeys");
  const vehicleId = await getActiveVehicleId();

  if (vehicleId == null) {
    return <NoVehicleState />;
  }

  const journeys = await getJourneys(vehicleId);
  const vehicles = await getVehicles();
  const activeVehicle =
    vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;

  return (
    <div className="mobile-journeys-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileJourneysHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={vehicleId}
        displayName={activeVehicle?.displayName ?? null}
        pageTitle={t("list.title")}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="route"
          title={t("list.title")}
          subtitle={t("list.subtitle")}
        />
      </div>

      <div className="relative z-10 -mt-5 flex justify-end md:mt-4">
        <Button
          href="/journeys/new"
          variant="primary"
          size="sm"
          icon={<Plus aria-hidden size={16} />}
        >
          {t("list.newJourney")}
        </Button>
      </div>

      {journeys.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Route}
            title={t("list.empty.title")}
            hint={t("list.empty.hint")}
            action={{
              label: t("list.newJourney"),
              href: "/journeys/new",
              icon: <Plus aria-hidden size={16} />,
            }}
            className="bg-white !px-4 !py-7 shadow-sm md:!px-6 md:!py-12 md:shadow-none"
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 md:mt-6 md:gap-3">
          {journeys.map((j) => (
            <Link
              key={j.id}
              href={`/journeys/${j.id}`}
              className="rounded-[18px] border border-l-4 border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-md md:rounded-2xl md:border-l md:p-4 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/50"
              style={{
                borderLeftColor: j.color ?? "#94a3b8",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 hidden h-3 w-3 shrink-0 rounded-full md:block"
                  style={{ backgroundColor: j.color ?? "#94a3b8" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-neutral-900 md:text-base md:font-medium dark:text-neutral-100">
                      {j.name}
                    </span>
                    <StatusBadge tone="neutral">
                      {t(`type.${j.type}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-neutral-500 md:text-xs dark:text-neutral-400">
                    {formatRange(j.startTime, j.endTime)}
                  </p>
                  <p className="mt-1 text-[12px] tabular-nums text-neutral-600 md:text-sm dark:text-neutral-300">
                    {formatKm(j.totalDistanceKm)} · {t("list.driveCount", { count: j.driveCount })} ·{" "}
                    {t("list.chargeCount", { count: j.chargeCount })}
                  </p>
                </div>
                <ChevronRight aria-hidden size={18} className="shrink-0 text-neutral-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
