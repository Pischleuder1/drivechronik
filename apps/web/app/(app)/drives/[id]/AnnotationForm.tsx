"use client";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronRight, WandSparkles } from "lucide-react";
import {
  updateDriveAnnotations,
  type UpdateAnnotationsResult,
} from "../../../../lib/actions/drives";
import { type Classification } from "../../../../lib/classification";
import { buttonClasses } from "../../../../components/ui/Button";

const CLASSIFICATION_OPTIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

const initialState: UpdateAnnotationsResult = { ok: false };

const fieldClasses =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";

export function AnnotationForm({
  driveId,
  classification,
  purpose,
  customer,
  project,
  notes,
  ruleCreateHref,
}: {
  driveId: number;
  classification: Classification;
  purpose: string | null;
  customer: string | null;
  project: string | null;
  notes: string | null;
  ruleCreateHref: string | null;
}) {
  const t = useTranslations("drives");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(
    updateDriveAnnotations,
    initialState,
  );
  const [savedPulse, setSavedPulse] = useState(false);

  // Controlled fields: React 19 auto-resets uncontrolled inputs to their
  // defaultValue when a form action completes, which would silently revert
  // edits (and re-submit stale values on the next save). Controlled state
  // is immune to that reset and keeps showing exactly what was saved.
  const [fields, setFields] = useState({
    classification: classification as string,
    purpose: purpose ?? "",
    customer: customer ?? "",
    project: project ?? "",
    notes: notes ?? "",
  });

  function setField(name: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    if (state.ok && !pending) {
      setSavedPulse(true);
      const t = setTimeout(() => setSavedPulse(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state, pending]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="driveId" value={driveId} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("annotationForm.classification")}
        </span>
        <select
          name="classification"
          value={fields.classification}
          onChange={(e) => setField("classification", e.target.value)}
          className={fieldClasses}
        >
          {CLASSIFICATION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {tCommon(`classification.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("annotationForm.purpose")}
        </span>
        <input
          type="text"
          name="purpose"
          value={fields.purpose}
          onChange={(e) => setField("purpose", e.target.value)}
          maxLength={500}
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("annotationForm.customer")}
        </span>
        <input
          type="text"
          name="customer"
          value={fields.customer}
          onChange={(e) => setField("customer", e.target.value)}
          maxLength={200}
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("annotationForm.project")}
        </span>
        <input
          type="text"
          name="project"
          value={fields.project}
          onChange={(e) => setField("project", e.target.value)}
          maxLength={200}
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("annotationForm.notes")}
        </span>
        <textarea
          name="notes"
          value={fields.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={4}
          maxLength={5000}
          className={fieldClasses}
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "md", "h-14 shrink-0")}
        >
          {pending ? t("annotationForm.saving") : tCommon("actions.save")}
        </button>

        {ruleCreateHref && (
          <Link
            href={ruleCreateHref}
            className="inline-flex h-14 flex-1 items-center gap-3 rounded-lg bg-red-600 px-4 text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-600 dark:hover:bg-red-500"
          >
            <WandSparkles aria-hidden size={20} className="shrink-0" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold leading-tight">
                {t("page.createRuleFromDrive")}
              </span>
              <span className="mt-0.5 block text-xs leading-tight text-red-100">
                {t("page.createRuleFromDriveHint")}
              </span>
            </span>
            <ChevronRight aria-hidden size={18} className="shrink-0" />
          </Link>
        )}

        {savedPulse && (
          <span className="self-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {t("annotationForm.saved")}
          </span>
        )}
      </div>
    </form>
  );
}
