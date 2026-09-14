import { getTranslations } from "next-intl/server";
import { getVehicles } from "../../../lib/queries";
import { getPlannerContext, getPlannerPlaces } from "../../../lib/planner";
import { getCurrentWeather } from "../../../lib/weather";
import { getOsrmUrl } from "../../../lib/config";
import { Planner } from "./Planner";

import { NoVehicleState } from "../../../components/NoVehicleState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

export const dynamic = "force-dynamic";

// Vorbelegung des SoC-Feldes, falls der aktuelle Fahrzeug-SoC nicht bekannt ist.
const FALLBACK_SOC = 80;
// Vorbelegung der Außentemperatur, falls kein Wetter abrufbar ist.
const FALLBACK_TEMP_C = 15;

export default async function PlannerPage() {
  const t = await getTranslations("planner");
  const vehicles = await getVehicles();
  if (vehicles.length === 0) {
    return (
      <div className="w-full">
        <PageHeader
          visual="route"
          title={t("title")}
          subtitle={t("subtitle")}
          eyebrow={
            <StatusBadge tone="amber">
              {t("experimentalBadge")}
            </StatusBadge>
          }
        />

        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }
  const vehicleId = vehicles[0]!.id;

  const [context, places] = await Promise.all([
    getPlannerContext(vehicleId),
    getPlannerPlaces(),
  ]);

  // Außentemperatur aus dem aktuellen Wetter an der Fahrzeugposition vorbelegen.
  let defaultTempC = FALLBACK_TEMP_C;
  if (context.status?.lat != null && context.status?.lon != null) {
    const weather = await getCurrentWeather(
      context.status.lat,
      context.status.lon,
    );
    if (weather) defaultTempC = Math.round(weather.temperature);
  }

  const defaultSoc =
    context.status?.soc != null ? context.status.soc : FALLBACK_SOC;

  return (
    <div className="w-full">
      <PageHeader
        visual="route"
        title={t("title")}
        subtitle={t("subtitle")}
        eyebrow={
          <StatusBadge tone="amber">
            {t("experimentalBadge")}
          </StatusBadge>
        }
      />

      <div className="mt-6">
        <Planner
          vehicleId={vehicleId}
          places={places}
          status={context.status}
          defaultSoc={defaultSoc}
          defaultTempC={defaultTempC}
          defaultCapacityKwh={Math.round(context.suggestedCapacityKwh)}
          capacityIsDerived={context.capacityIsDerived}
          historyDriveCount={context.historyDriveCount}
          osrmIsDefault={getOsrmUrl() == null}
        />
      </div>
    </div>
  );
}
