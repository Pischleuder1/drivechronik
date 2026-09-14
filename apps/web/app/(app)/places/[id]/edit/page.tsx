import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getAllPlacesWithUsage, getPlaceById } from "../../../../../lib/queries";
import { PlaceForm } from "../../PlaceForm";
import { DeletePlaceButton } from "../../DeletePlaceButton";
import { buttonClasses } from "../../../../../components/ui/Button";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Panel } from "../../../../../components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("places");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId) || placeId <= 0) notFound();

  const place = await getPlaceById(placeId);
  if (!place) notFound();

  const allWithUsage = await getAllPlacesWithUsage();
  const usage = allWithUsage.find((p) => p.id === placeId);
  const usageCount = usage
    ? usage.driveStartCount + usage.driveEndCount + usage.chargeCount + usage.parkCount
    : 0;

  const ruleParams = new URLSearchParams({
    endPlaceId: String(place.id),
    name: t("autoClassification.ruleName", { name: place.name }),
  });

  if (place.type === "customer") {
    ruleParams.set("classification", "business");
    ruleParams.set("customer", place.name);
  }

  const ruleHref = `/rules/new?${ruleParams.toString()}`;

  return (
    <div className="w-full">
      <Link
        href="/places"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <PageHeader
        visual="places"
        className="mt-3"
        title={t("editTitle", { name: place.name })}
      />

      <Panel className="mt-6">
        <PlaceForm
          initial={{
            id: place.id,
            name: place.name,
            type: place.type,
            lat: place.lat,
            lon: place.lon,
            radiusM: place.radiusM,
            address: place.address,
            electricityPricePerKwh: place.electricityPricePerKwh,
            electricityPriceCurrency: place.electricityPriceCurrency,
          }}
        />
      </Panel>

      <Panel
        className="mt-6"
        title={t("autoClassification.title")}
        subtitle={t("autoClassification.description")}
      >
        {place.type === "customer" && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("autoClassification.customerHint")}
          </p>
        )}

        <div className={place.type === "customer" ? "mt-3" : ""}>
          <Link
            href={ruleHref}
            className={buttonClasses("secondary", "sm")}
          >
            {t("autoClassification.createRule")}
          </Link>
        </div>
      </Panel>

      <Panel
        className="mt-6"
        title={t("dangerZone.title")}
        subtitle={t("dangerZone.usage", { count: usageCount })}
      >
        <DeletePlaceButton
          placeId={place.id}
          placeName={place.name}
          usageCount={usageCount}
        />
      </Panel>
    </div>
  );
}
