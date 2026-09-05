"use client";

import { useActionState } from "react";
import { updateReportIdentity } from "../../../lib/actions/settings";

interface VehicleOption {
  id: number;
  displayName: string;
  licensePlate: string | null;
}

interface ReportIdentityFormProps {
  driverName: string;
  vehicles: VehicleOption[];
}

const initialState: {
  ok: boolean;
  error?: string;
} = {
  ok: false,
};

export function ReportIdentityForm({
  driverName,
  vehicles,
}: ReportIdentityFormProps) {
  const [state, formAction, pending] = useActionState(
    updateReportIdentity,
    initialState,
  );

  const defaultVehicle = vehicles[0];

  if (!defaultVehicle) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Kein Fahrzeug vorhanden.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="driverName"
          className="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
        >
          Fahrername
        </label>
        <input
          id="driverName"
          name="driverName"
          type="text"
          maxLength={120}
          defaultValue={driverName}
          placeholder="Vor- und Nachname"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div>
        <label
          htmlFor="vehicleId"
          className="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
        >
          Fahrzeug
        </label>
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={defaultVehicle.id}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="licensePlate"
          className="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
        >
          Kfz-Kennzeichen
        </label>
        <input
          id="licensePlate"
          name="licensePlate"
          type="text"
          maxLength={32}
          defaultValue={defaultVehicle.licensePlate ?? ""}
          placeholder="z. B. MI-AB 123"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Fahrername und Kennzeichen werden für Fahrtenbuchberichte und spätere
        Monatsabschlüsse verwendet.
      </p>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {state.ok && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Berichtsdaten gespeichert.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}
