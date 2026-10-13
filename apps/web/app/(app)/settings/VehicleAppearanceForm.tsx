"use client";

import { useActionState } from "react";
import {
  updateVehicleAppearance,
  type VehicleAppearanceResult,
} from "../../../lib/actions/settings";

const initialState: VehicleAppearanceResult = { ok: false };

export function VehicleAppearanceForm({
  vehicleId,
  variantOverride,
  exteriorColor,
  isModelY,
}: {
  vehicleId: number;
  variantOverride: string | null;
  exteriorColor: string | null;
  isModelY: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateVehicleAppearance,
    initialState,
  );

  return (
    <form action={action} className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">
            Fahrzeugvariante
          </span>
          <select
            name="variantOverride"
            defaultValue={variantOverride ?? ""}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Automatisch erkennen</option>
            {isModelY && (
              <>
                <option value="model-y-juniper-standard">
                  Model Y Juniper Standard
                </option>
                <option value="model-y-juniper-premium">
                  Model Y Juniper Premium
                </option>
              </>
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">
            Außenfarbe
          </span>
          <select
            name="exteriorColor"
            defaultValue={exteriorColor ?? ""}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Unbekannt / automatisch</option>
            <option value="white">Weiß</option>
            <option value="black">Schwarz</option>
            <option value="grey">Grau</option>
            <option value="stealth_grey">Stealth Grey</option>
            <option value="silver">Silber</option>
            <option value="blue">Blau</option>
            <option value="red">Rot</option>
            <option value="other">Sonstige Farbe</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-rose-800/50 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-800/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-800/50 dark:hover:bg-rose-700/65"
        >
          {pending ? "Speichert ..." : "Fahrzeugkonfiguration speichern"}
        </button>

        {state.error && (
          <span role="alert" className="text-sm text-red-600">
            {state.error}
          </span>
        )}

        {state.ok && (
          <span role="status" className="text-sm text-green-600">
            Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}
