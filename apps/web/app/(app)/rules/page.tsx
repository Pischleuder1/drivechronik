import { getTranslations } from "next-intl/server";
import { Plus, Wand2 } from "lucide-react";
import {
  getClassificationRules,
  getRuleSuggestions,
  getUnclassifiedLiveCount,
} from "../../../lib/rules";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { ApplyRulesButton } from "./ApplyRulesButton";
import { RuleRow } from "./RuleRow";

export const dynamic = "force-dynamic";

function formatSuggestionWeekdays(weekdays: number[]): string {
  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  if (
    weekdays.length === 5 &&
    weekdays.every((day, index) => day === index + 1)
  ) {
    return "Mo–Fr";
  }

  return weekdays.map((day) => labels[day - 1]).filter(Boolean).join(", ");
}

function formatSuggestionTime(
  startMinuteFrom: number | null,
  startMinuteTo: number | null,
): string {
  const formatMinute = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
      minute % 60,
    ).padStart(2, "0")}`;

  if (startMinuteFrom == null || startMinuteTo == null) {
    return "";
  }

  return `${formatMinute(startMinuteFrom)}–${formatMinute(startMinuteTo)}`;
}

export default async function RulesPage() {
  const t = await getTranslations("rules");
  const [rules, liveUnclassified, suggestions] = await Promise.all([
    getClassificationRules(),
    getUnclassifiedLiveCount(),
    getRuleSuggestions(),
  ]);

  return (
    <div className="w-full">
      <PageHeader
        visual="tools"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            href="/rules/new"
            variant="primary"
            className="shrink-0"
            icon={<Plus aria-hidden size={16} />}
          >
            {t("newRule")}
          </Button>
        }
      />

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t("manualUntouchedNotice")}
      </div>

      {rules.length > 0 && (
        <Panel className="mt-4">
          <ApplyRulesButton liveUnclassified={liveUnclassified} />
        </Panel>
      )}

      {suggestions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <SectionHeader
            title={t("suggestions.title")}
            subtitle={t("suggestions.hint")}
            count={suggestions.length}
            tone="violet"
            className="mb-3"
          />

          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={`${suggestion.startPlaceId}:${suggestion.endPlaceId}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-800/50"
              >
                <div>
                  <div className="font-medium">
                    {suggestion.startPlaceName} → {suggestion.endPlaceName}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {t("suggestions.driveCount", {
                      count: suggestion.driveCount,
                    })}{" "}
                    ·{" "}
                    {formatSuggestionWeekdays(suggestion.weekdays)}
                    {suggestion.startMinuteFrom != null &&
                      suggestion.startMinuteTo != null && (
                        <>
                          {" "}·{" "}
                          {formatSuggestionTime(
                            suggestion.startMinuteFrom,
                            suggestion.startMinuteTo,
                          )}
                          {t("suggestions.timeSuffix") &&
                            ` ${t("suggestions.timeSuffix")}`}
                        </>
                      )}
                  </div>
                  {suggestion.confidence != null && (
                    <div className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      {t(`suggestions.confidence.${suggestion.confidence}`)}
                    </div>
                  )}
                </div>

                <Button
                  href={`/rules/new?${new URLSearchParams([
                    ["startPlaceId", String(suggestion.startPlaceId)],
                    ["endPlaceId", String(suggestion.endPlaceId)],
                    ...suggestion.weekdays.map((day) => ["weekdays", String(day)]),
                    ...(suggestion.startMinuteFrom != null
                      ? [["startMinuteFrom", String(suggestion.startMinuteFrom)]]
                      : []),
                    ...(suggestion.startMinuteTo != null
                      ? [["startMinuteTo", String(suggestion.startMinuteTo)]]
                      : []),
                  ]).toString()}`}
                  variant="secondary"
                  className="shrink-0"
                >
                  {t("suggestions.create")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {rules.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title={t("empty.title")}
            hint={t("empty.hint")}
            action={{
              label: t("newRule"),
              href: "/rules/new",
              icon: <Plus aria-hidden size={16} />,
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white px-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
