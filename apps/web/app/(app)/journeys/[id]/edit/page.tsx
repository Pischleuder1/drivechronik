import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getJourneyById } from "../../../../../lib/journeys";
import { getActiveVehicleId } from "../../../../../lib/activeVehicle";
import { toDateTimeLocal } from "../../../../../lib/day";
import { JourneyForm, type JourneyFormValues } from "../../JourneyForm";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Panel } from "../../../../../components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function EditJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const journeyId = Number(id);
  if (!Number.isInteger(journeyId) || journeyId <= 0) notFound();

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) notFound();

  const journey = await getJourneyById(journeyId, vehicleId);
  if (!journey) notFound();

  const initial: JourneyFormValues = {
    id: journey.id,
    name: journey.name,
    type: journey.type,
    startTime: toDateTimeLocal(journey.startTime),
    endTime: toDateTimeLocal(journey.endTime),
    color: journey.color,
    description: journey.description,
  };

  return (
    <div className="w-full">
      <Link
        href={`/journeys/${journey.id}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <PageHeader
        visual="route"
        className="mt-3"
        title={t("editTitle")}
      />

      <Panel className="mt-4">
        <JourneyForm initial={initial} />
      </Panel>
    </div>
  );
}
