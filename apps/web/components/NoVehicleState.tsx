import { Car } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "./ui/EmptyState";

export async function NoVehicleState() {
  const t = await getTranslations("common");

  return (
    <EmptyState
      icon={Car}
      title={t("noVehicleLoaded.title")}
      hint={t("noVehicleLoaded.hint")}
    />
  );
}
