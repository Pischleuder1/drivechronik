import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import {
  getAllPlacesLite,
  getAllTags,
  getVehiclesDetailed,
} from "../../../../lib/queries";
import { getActiveVehicleId } from "../../../../lib/activeVehicle";
import { RuleForm } from "../RuleForm";
import { buildRulePrefill } from "../../../../lib/rulePrefill";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";
import { MobileRuleFormHero } from "../MobileRuleFormHero";

export const dynamic = "force-dynamic";

export default async function NewRulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");

  const [
    params,
    places,
    tags,
    vehicles,
    activeVehicleId,
  ] = await Promise.all([
    searchParams,
    getAllPlacesLite(),
    getAllTags(),
    getVehiclesDetailed(),
    getActiveVehicleId(),
  ]);

  const initial = buildRulePrefill(
    params,
    places.map((place) => place.id),
  );

  return (
    <div className="mobile-rule-form-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileRuleFormHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={activeVehicleId}
        title={t("newTitle")}
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
          title={t("newTitle")}
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
