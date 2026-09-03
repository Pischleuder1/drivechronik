import { getTranslations } from "next-intl/server";
import { Plus, Wand2 } from "lucide-react";
import {
  getClassificationRules,
  getRuleSuggestions,
  getUnclassifiedLiveCount,
} from "../../../lib/rules";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
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
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t("manualUntouchedNotice")}
      </div>

      {rules.length > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <ApplyRulesButton liveUnclassified={liveUnclassified} />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3">
            <h2 className="font-medium">{t("suggestions.title")}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t("suggestions.hint")}
            </p>
          </div>

          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={`${suggestion.startPlaceId}:${suggestion.endPlaceId}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-3 py-3 dark:border-neutral-800"
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
          <div className="rounded-xl border border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
