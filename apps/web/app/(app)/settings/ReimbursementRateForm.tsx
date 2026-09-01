"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  updateBusinessReimbursementRate,
  type ReimbursementRateResult,
} from "../../../lib/actions/settings";
import { buttonClasses } from "../../../components/ui/Button";

const initialState: ReimbursementRateResult = { ok: false };

export function ReimbursementRateForm({
  currentRate,
}: {
  currentRate: number;
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessReimbursementRate,
    initialState,
  );

  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("reimbursementRate.label")}
        <input
          type="number"
          name="rateEurPerKm"
          min={0}
          max={10}
          step={0.01}
          required
          defaultValue={currentRate.toFixed(2)}
          className="w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-neutral-400">
          {t("reimbursementRate.unit")}
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("secondary", "sm")}
      >
        {pending
          ? t("reimbursementRate.saving")
          : tCommon("actions.save")}
      </button>

      {state.error && (
        <span
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {state.error}
        </span>
      )}

      {state.ok && (
        <span className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("reimbursementRate.saved")}
        </span>
      )}

      <p className="w-full text-xs text-neutral-500 dark:text-neutral-400">
        {t("reimbursementRate.hint")}
      </p>
    </form>
  );
}
