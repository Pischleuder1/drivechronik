import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getAllPlacesLite, getAllTags } from "../../../../lib/queries";
import { RuleForm } from "../RuleForm";
import { buildRulePrefill } from "../../../../lib/rulePrefill";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function NewRulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");

  const [params, places, tags] = await Promise.all([
    searchParams,
    getAllPlacesLite(),
    getAllTags(),
  ]);

  const initial = buildRulePrefill(
    params,
    places.map((place) => place.id),
  );

  return (
    <div className="mx-auto max-w-2xl">
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
