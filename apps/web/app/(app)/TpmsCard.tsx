import { CheckCircle2, Gauge, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { assessTpms, type TpmsTireAssessment } from "@drivechronik/core";
import type { VehicleStatusRow } from "../../lib/dashboard";
import { IconBadge } from "../../components/ui/IconBadge";

const barFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatBar(value: number): string {
  return `${barFormatter.format(value)} bar`;
}

function Tire({
  label,
  tire,
  align,
}: {
  label: string;
  tire: TpmsTireAssessment;
  align: "left" | "right";
}) {
  return (
    <div
      className={`rounded-2xl border border-transparent p-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${
        tire.warn
          ? "bg-amber-50 dark:bg-amber-950/40"
          : "bg-neutral-50 dark:bg-neutral-800/60"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>

      <p
        className={`mt-1 text-base font-semibold tabular-nums ${
          tire.warn
            ? "text-amber-700 dark:text-amber-400"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {tire.value != null ? formatBar(tire.value) : "—"}
      </p>
    </div>
  );
}

export async function TpmsCard({
  status,
}: {
  status: VehicleStatusRow;
}) {
  const { tpmsFlBar, tpmsFrBar, tpmsRlBar, tpmsRrBar } = status;

  if (
    tpmsFlBar == null &&
    tpmsFrBar == null &&
    tpmsRlBar == null &&
    tpmsRrBar == null
  ) {
    return null;
  }

  const t = await getTranslations("dashboard");

  const assessment = assessTpms({
    fl: tpmsFlBar,
    fr: tpmsFrBar,
    rl: tpmsRlBar,
    rr: tpmsRrBar,
  });

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconBadge
            tone={assessment.anyWarn ? "amber" : "cyan"}
            size="sm"
          >
            <Gauge aria-hidden size={18} />
          </IconBadge>

          <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
            {t("tpms.title")}
          </h2>
        </div>

        {!assessment.anyWarn && (
          <CheckCircle2
            aria-hidden
            size={18}
            className="text-emerald-500"
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Tire label={t("tpms.fl")} tire={assessment.fl} align="left" />
        <Tire label={t("tpms.fr")} tire={assessment.fr} align="right" />
        <Tire label={t("tpms.rl")} tire={assessment.rl} align="left" />
        <Tire label={t("tpms.rr")} tire={assessment.rr} align="right" />
      </div>

      {assessment.anyWarn && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <TriangleAlert aria-hidden size={15} />
          {t("tpms.checkWarning")}
        </p>
      )}
    </section>
  );
}
