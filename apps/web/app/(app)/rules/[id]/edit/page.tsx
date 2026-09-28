import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getRuleById } from "../../../../../lib/rules";
import {
  getAllPlacesLite,
  getAllTags,
  getVehiclesDetailed,
} from "../../../../../lib/queries";
import { getActiveVehicleId } from "../../../../../lib/activeVehicle";
import { RuleForm, type RuleFormValues } from "../../RuleForm";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Panel } from "../../../../../components/ui/Panel";
import { MobileRuleFormHero } from "../../MobileRuleFormHero";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) notFound();

  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");
  const [
    rule,
    places,
    tags,
    vehicles,
    activeVehicleId,
  ] = await Promise.all([
    getRuleById(ruleId),
    getAllPlacesLite(),
    getAllTags(),
    getVehiclesDetailed(),
    getActiveVehicleId(),
  ]);
  if (!rule) notFound();

  // Regel-Klassifizierung als Aktion ist nie 'unclassified' (nur die drei
  // sinnvollen Werte oder null "nicht ändern").
  const classification =
    rule.classification === "private" ||
    rule.classification === "business" ||
    rule.classification === "commute"
      ? rule.classification
      : null;

  const initial: RuleFormValues = {
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    enabled: rule.enabled,
    startPlaceId: rule.startPlaceId,
    endPlaceId: rule.endPlaceId,
    weekdays: rule.weekdays,
    startMinuteFrom: rule.startMinuteFrom,
    startMinuteTo: rule.startMinuteTo,
    classification,
    tagId: rule.tagId,
    purpose: rule.purpose,
    customer: rule.customer,
    project: rule.project,
  };

  return (
    <div className="mobile-rule-form-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileRuleFormHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={activeVehicleId}
        title={t("editTitle")}
        backLabel={tCommon("actions.back")}
      />

      <div className="hidden md:block">
        <Link
          href="/rules"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <ChevronLeft aria-hidden size={16} />
          {tCommon("actions.back")}
        </Link>

        <PageHeader
          visual="tools"
          className="mt-3"
          title={t("editTitle")}
        />
      </div>

      <Panel className="mt-6">
        <RuleForm
          initial={initial}
          places={places}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        />
      </Panel>
    </div>
  );
}
