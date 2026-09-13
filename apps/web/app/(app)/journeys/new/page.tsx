import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { JourneyForm } from "../JourneyForm";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function NewJourneyPage() {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  return (
    <div className="mx-auto max-w-2xl">
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

      <Panel className="mt-4">
        <JourneyForm />
      </Panel>
    </div>
  );
}
