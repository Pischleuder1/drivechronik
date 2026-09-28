import { getTranslations } from "next-intl/server";
import { Tag as TagIcon } from "lucide-react";
import { getAllTags } from "../../../lib/queries";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { CreateTagForm } from "./CreateTagForm";
import { TagRow } from "./TagRow";
import { MobileTagsHero } from "./MobileTagsHero";
import { getActiveVehicleId } from "../../../lib/activeVehicle";
import { getVehiclesDetailed } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const t = await getTranslations("tags");
  const [tags, vehicles, activeVehicleId] = await Promise.all([
    getAllTags(),
    getVehiclesDetailed(),
    getActiveVehicleId(),
  ]);

  return (
    <div className="mobile-tags-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileTagsHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={activeVehicleId}
        title={t("title")}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="tools"
          title={t("title")}
          subtitle={t("description")}
        />
      </div>

      <div className="mt-6">
        <CreateTagForm />
      </div>

      <div className="mt-6">
        {tags.length === 0 ? (
          <EmptyState icon={TagIcon} title={t("empty")} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
