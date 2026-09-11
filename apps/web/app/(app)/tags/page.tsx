import { getTranslations } from "next-intl/server";
import { Tag as TagIcon } from "lucide-react";
import { getAllTags } from "../../../lib/queries";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { CreateTagForm } from "./CreateTagForm";
import { TagRow } from "./TagRow";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const t = await getTranslations("tags");
  const tags = await getAllTags();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
      />

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
