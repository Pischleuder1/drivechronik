import "server-only";

import { cookies } from "next/headers";
import { getVehicles, type Vehicle } from "./queries";

export const ACTIVE_VEHICLE_COOKIE = "drivechronik_vehicle";

function parseVehicleId(value: string | null | undefined): number | null {
  if (!value) return null;

  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Resolves the active vehicle.
 *
 * If the cookie references a vehicle that no longer exists, the first
 * available vehicle is used as a safe fallback.
 */
export function resolveActiveVehicle(
  vehicles: Vehicle[],
  cookieValue: string | null | undefined,
): Vehicle | null {
  if (vehicles.length === 0) return null;

  const requestedId = parseVehicleId(cookieValue);

  if (requestedId != null) {
    const requested = vehicles.find((vehicle) => vehicle.id === requestedId);
    if (requested) return requested;
  }

  return vehicles[0]!;
}

export async function getActiveVehicle(): Promise<Vehicle | null> {
  const vehicles = await getVehicles();

  if (vehicles.length === 0) return null;

  const cookieStore = await cookies();

  return resolveActiveVehicle(
    vehicles,
    cookieStore.get(ACTIVE_VEHICLE_COOKIE)?.value,
  );
}

export async function getActiveVehicleId(): Promise<number | null> {
  const vehicle = await getActiveVehicle();
  return vehicle?.id ?? null;
}
