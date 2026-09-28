import { getTranslations } from "next-intl/server";
import { getActiveVehicleId } from "../../../lib/activeVehicle";
import {
  DEFAULT_BATTERY_CAPACITY_KWH,
  getPlannerContext,
  getPlannerPlaces,
} from "../../../lib/planner";
import { getCurrentWeather } from "../../../lib/weather";
import { getOsrmUrl } from "../../../lib/config";
import { getVehicleAnalytics } from "../../../lib/vehicleAnalytics";
import { getVehicles } from "../../../lib/queries";
import { Planner } from "./Planner";
import { MobilePlannerHero } from "./MobilePlannerHero";

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
  const vehicleId = await getActiveVehicleId();

  if (vehicleId == null) {
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
  const [context, places, analytics, vehicles] = await Promise.all([
    getPlannerContext(vehicleId),
    getPlannerPlaces(),
    getVehicleAnalytics(vehicleId),
    getVehicles(),
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

  // Bevorzugt die bereits vorhandene Schätzung der nutzbaren
  // Batteriekapazität aus geeigneten Ladevorgängen.
  const estimatedCapacityKwh =
    analytics.battery.usableCapacityKwh;

  // Solange keine geeigneten Ladevorgänge vorliegen, bleibt der
  // allgemeine Vorgabewert als editierbarer Fallback erhalten.
  const defaultCapacityKwh =
    estimatedCapacityKwh ?? DEFAULT_BATTERY_CAPACITY_KWH;

  return (
    <div className="mobile-planner-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobilePlannerHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={vehicleId}
        title={t("title")}
        experimentalLabel={t("experimentalBadge")}
      />

      <div className="hidden md:block">
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
      </div>

      <div className="relative z-10 -mt-5 md:mt-6">
        <Planner
          key={vehicleId}
          vehicleId={vehicleId}
          places={places}
          status={context.status}
          defaultSoc={defaultSoc}
          defaultTempC={defaultTempC}
          defaultCapacityKwh={Number(defaultCapacityKwh.toFixed(1))}
          capacityIsDerived={estimatedCapacityKwh != null}
          historyDriveCount={context.historyDriveCount}
          osrmIsDefault={getOsrmUrl() == null}
        />
      </div>
    </div>
  );
}
