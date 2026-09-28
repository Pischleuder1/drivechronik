import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getActiveVehicleId } from "../../../../lib/activeVehicle";
import { getVehicles } from "../../../../lib/queries";
import { JourneyForm } from "../JourneyForm";
import { MobileJourneyFormHero } from "../MobileJourneyFormHero";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function NewJourneyPage() {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const vehicleId = await getActiveVehicleId();
  const vehicles = await getVehicles();

  return (
    <div className="mobile-journey-form-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileJourneyFormHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={vehicleId}
        title={t("list.newJourney")}
        backHref="/journeys"
        backLabel={tCommon("actions.back")}
      />

      <div className="hidden md:block">
        <Link
          href="/journeys"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <ChevronLeft aria-hidden size={16} />
          {tCommon("actions.back")}
        </Link>

        <PageHeader
          visual="route"
          className="mt-3"
          title={t("list.newJourney")}
        />
      </div>

      <Panel className="relative z-10 -mt-5 md:mt-4">
        <JourneyForm />
      </Panel>
    </div>
  );
}
