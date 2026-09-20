import Link from "next/link";
import webPackage from "../../../package.json";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Archive,
  CalendarDays,
  Car,
  ChevronRight,
  Download,
  FileBarChart,
  Lightbulb,
  Navigation,
  Tags,
  Upload,
  Wand2,
} from "lucide-react";
import { getBusinessReimbursementRateEurPerKm, getDriverName } from "../../../lib/appSettings";
import { APP_TIMEZONE } from "../../../lib/config";
import { formatRelativeTime } from "../../../lib/day";
import { getSyncState, getVehiclesDetailed } from "../../../lib/queries";
import { entityLabel, buildEntityLabels } from "../../../lib/diagnostics";
import { getSoftwareUpdates } from "../../../lib/softwareUpdates";
import { LogoutButton } from "./LogoutButton";
import { ResyncButton } from "./ResyncButton";
import { EfficiencyOverrideForm } from "./EfficiencyOverrideForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { ReimbursementRateForm } from "./ReimbursementRateForm";
import { ReportIdentityForm } from "./ReportIdentityForm";
import { SoftwareTimeline } from "./SoftwareTimeline";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";

export const dynamic = "force-dynamic";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="mt-6" title={title}>
      {children}
    </Panel>
  );
}

function maskVin(vin: string | null): string {
  if (vin == null || vin.length < 4) return "—";
  return `${"•".repeat(Math.max(vin.length - 4, 0))}${vin.slice(-4)}`;
}

export default async function SettingsPage() {
  const [t, locale, vehicles, syncRows, reimbursementRate, driverName] =
    await Promise.all([
      getTranslations("settings"),
      getLocale(),
      getVehiclesDetailed(),
      getSyncState(),
      getBusinessReimbursementRateEurPerKm(),
      getDriverName(),
    ]);
  const defaultVehicleId = vehicles[0]?.id;
  const softwareUpdates =
    defaultVehicleId != null ? await getSoftwareUpdates(defaultVehicleId) : [];
  const entityLabels = buildEntityLabels(t);

  const linkGroups = [
    {
      title: t("linkGroups.general"),
      headerClass:
        "border-sky-100 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/30",
      titleClass: "text-sky-700 dark:text-sky-300",
      items: [
        {
          href: "/vehicle",
          label: t("links.vehicle"),
          description: t("linkDescriptions.vehicle"),
          icon: Car,
        },
        {
          href: "/planner",
          label: t("links.planner"),
          description: t("linkDescriptions.planner"),
          icon: Navigation,
        },
        {
          href: "/rules",
          label: t("rulesLink.title"),
          description: t("rulesLink.subtitle"),
          icon: Wand2,
        },
      ],
    },
    {
      title: t("linkGroups.data"),
      headerClass:
        "border-emerald-100 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30",
      titleClass: "text-emerald-700 dark:text-emerald-300",
      items: [
        {
          href: "/import",
          label: t("links.import"),
          description: t("linkDescriptions.import"),
          icon: Upload,
        },
        {
          href: "/export",
          label: t("links.export"),
          description: t("linkDescriptions.export"),
          icon: Download,
        },
        {
          href: "/tags",
          label: t("links.tags"),
          description: t("linkDescriptions.tags"),
          icon: Tags,
        },
      ],
    },
    {
      title: t("linkGroups.organization"),
      headerClass:
        "border-amber-100 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30",
      titleClass: "text-amber-700 dark:text-amber-300",
      items: [
        {
          href: "/journeys",
          label: t("links.journeys"),
          description: t("linkDescriptions.journeys"),
          icon: Archive,
        },
        {
          href: "/calendar",
          label: t("links.calendar"),
          description: t("linkDescriptions.calendar"),
          icon: CalendarDays,
        },
      ],
    },
    {
      title: t("linkGroups.analysis"),
      headerClass:
        "border-violet-100 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-950/30",
      titleClass: "text-violet-700 dark:text-violet-300",
      items: [
        {
          href: "/reports",
          label: t("links.reports"),
          description: t("linkDescriptions.reports"),
          icon: FileBarChart,
        },
        {
          href: "/insights",
          label: t("links.insights"),
          description: t("linkDescriptions.insights"),
          icon: Lightbulb,
        },
      ],
    },
  ];

  return (
    <div className="w-full">
      <PageHeader
        visual="tools"
        title={t("title")}
        subtitle={t("subtitle")}
      />


      <Card title={t("vehicles.title")}>
        <div className="flex flex-col gap-3">
          {vehicles.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("vehicles.empty")}
            </p>
          )}
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0 dark:border-neutral-800"
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="col-span-2 font-medium text-neutral-900 dark:text-neutral-100">
                  {v.displayName}
                </dt>
                <dt className="text-neutral-500 dark:text-neutral-400">{t("vehicles.model")}</dt>
                <dd className="text-right tabular-nums">{v.model ?? "—"}</dd>
                <dt className="text-neutral-500 dark:text-neutral-400">{t("vehicles.vin")}</dt>
                <dd className="text-right font-mono tabular-nums">{maskVin(v.vin)}</dd>
                <dt className="text-neutral-500 dark:text-neutral-400">
                  {t("vehicles.efficiencyTeslamate")}
                </dt>
                <dd className="text-right tabular-nums">
                  {v.efficiencyKwhPerKm != null
                    ? `${(v.efficiencyKwhPerKm * 1000).toFixed(0)} Wh/km`
                    : t("vehicles.efficiencyNotLearned")}
                </dd>
              </dl>
              <EfficiencyOverrideForm
                vehicleId={v.id}
                currentWhPerKm={
                  v.efficiencyOverrideKwhPerKm != null
                    ? Math.round(v.efficiencyOverrideKwhPerKm * 1000)
                    : null
                }
                teslaMateHasLearned={v.efficiencyKwhPerKm != null}
              />
            </div>
          ))}
        </div>
        <SoftwareTimeline updates={softwareUpdates} embedded />
      </Card>

      <Card title={t("reportIdentity.title")}>
        <ReportIdentityForm
          driverName={driverName}
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            displayName: vehicle.displayName,
            licensePlate: vehicle.licensePlate,
          }))}
        />
      </Card>

      <Card title={t("reimbursementRate.title")}>
        <ReimbursementRateForm currentRate={reimbursementRate} />
      </Card>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {linkGroups.map((group) => (
          <section
            key={group.title}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div
              className={`border-b px-5 py-3 ${group.headerClass}`}
            >
              <h2
                className={`text-xs font-semibold uppercase tracking-[0.08em] ${group.titleClass}`}
              >
                {group.title}
              </h2>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition-colors group-hover:bg-neutral-900 group-hover:text-white dark:bg-neutral-800 dark:text-neutral-300 dark:group-hover:bg-neutral-100 dark:group-hover:text-neutral-900">
                      <Icon
                        aria-hidden
                        size={20}
                        strokeWidth={1.9}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                        {item.description}
                      </span>
                    </span>

                    <ChevronRight
                      aria-hidden
                      size={18}
                      className="shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <DiagnosticsCard />

      <Card title={t("sync.title")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <tr>
                <th className="py-1.5 pr-2">{t("sync.entity")}</th>
                <th className="py-1.5 pr-2">{t("sync.run")}</th>
                <th className="py-1.5 pr-2">{t("sync.status")}</th>
                <th className="hidden py-1.5 pr-2 sm:table-cell">{t("sync.watermark")}</th>
                <th className="hidden py-1.5 text-right sm:table-cell">{t("sync.rows")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {syncRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-neutral-500 dark:text-neutral-400">
                    {t("sync.empty")}
                  </td>
                </tr>
              )}
              {syncRows.map((row) => {
                const ok = row.lastStatus === "ok";
                return (
                  <tr key={`${row.source}-${row.entity}`}>
                    <td className="max-w-[7.5rem] truncate py-2 pr-2 font-medium text-neutral-900 dark:text-neutral-100 sm:max-w-none sm:whitespace-nowrap">
                      {entityLabel(row.source, row.entity, entityLabels)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 text-xs tabular-nums text-neutral-600 sm:text-sm dark:text-neutral-400">
                      {row.lastRunAt ? formatRelativeTime(row.lastRunAt, locale) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2">
                      <span
                        title={!ok ? (row.lastError ?? undefined) : undefined}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ok
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {ok ? t("sync.ok") : t("sync.error")}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap py-2 pr-2 tabular-nums text-neutral-600 sm:table-cell dark:text-neutral-400">
                      {row.watermarkTs ? formatRelativeTime(row.watermarkTs, locale) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap py-2 text-right tabular-nums text-neutral-600 sm:table-cell dark:text-neutral-400">
                      {row.rowsUpserted ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {syncRows.some((r) => r.lastStatus !== "ok" && r.lastError) && (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t("sync.errorHint")}
          </p>
        )}

        <div className="mt-4">
          <ResyncButton />
        </div>
      </Card>

      <Card title={t("display.title")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-neutral-500 dark:text-neutral-400">{t("display.timezone")}</dt>
            <dd className="text-right font-medium tabular-nums">{APP_TIMEZONE}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-neutral-500 dark:text-neutral-400">{t("display.dateFormat")}</dt>
            <dd className="text-right font-medium">de-DE</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-neutral-500 dark:text-neutral-400">{t("display.units")}</dt>
            <dd className="text-right font-medium">km</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {t("display.note")}
        </p>
      </Card>

      <Card title={t("security.title")}>
        <PasswordChangeForm />
      </Card>

      <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <LogoutButton />
      </div>
      <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
        DriveChronik {webPackage.version}
      </p>
    </div>
  );
}
