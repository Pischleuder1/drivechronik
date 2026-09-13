import Link from "next/link";
import { Plus, Route, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatKm } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../lib/config";
import { getJourneys } from "../../../lib/journeys";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

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
  const journeys = await getJourneys();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        visual="route"
        title={t("list.title")}
        subtitle={t("list.subtitle")}
        actions={
          <Button
            href="/journeys/new"
            variant="primary"
            size="sm"
            icon={<Plus aria-hidden size={16} />}
          >
            {t("list.newJourney")}
          </Button>
        }
      />

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
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {journeys.map((j) => (
            <Link
              key={j.id}
              href={`/journeys/${j.id}`}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/50"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: j.color ?? "#94a3b8" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {j.name}
                    </span>
                    <StatusBadge tone="neutral">
                      {t(`type.${j.type}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {formatRange(j.startTime, j.endTime)}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
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
