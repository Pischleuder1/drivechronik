import { NextResponse } from "next/server";

import { validateSession } from "../../../../lib/auth/session";
import { getActiveVehicleId } from "../../../../lib/activeVehicle";
import { getVehicleStatus } from "../../../../lib/dashboard";
import {
  buildRangeBoundary,
  buildRangeSamplePoints,
  calculateRangeBudgetKm,
} from "../../../../lib/rangeMapLogic";
import { fetchRangeRoadDistances } from "../../../../lib/rangeMapOsrm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESERVE_SOC = 10;

export async function GET() {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_authenticated",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const vehicleId = await getActiveVehicleId();

  if (vehicleId == null) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_vehicle",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const status = await getVehicleStatus(vehicleId);

  if (!status) {
    return NextResponse.json(
      {
        ok: false,
        error: "status_unavailable",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  if (status.lat == null || status.lon == null) {
    return NextResponse.json(
      {
        ok: false,
        error: "position_unavailable",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  if (status.soc == null || status.ratedRangeKm == null) {
    return NextResponse.json(
      {
        ok: false,
        error: "range_unavailable",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const origin = {
    lat: status.lat,
    lon: status.lon,
  };

  const rangeBudgetKm = calculateRangeBudgetKm({
    soc: status.soc,
    ratedRangeKm: status.ratedRangeKm,
    reserveSoc: RESERVE_SOC,
  });

  if (rangeBudgetKm <= 0) {
    return NextResponse.json(
      {
        ok: true,
        vehicleId,
        origin,
        soc: status.soc,
        ratedRangeKm: status.ratedRangeKm,
        reserveSoc: RESERVE_SOC,
        rangeBudgetKm: 0,
        boundary: [],
        osrmIsDefault: null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const samples = buildRangeSamplePoints(
    origin,
    rangeBudgetKm,
  );

  const distances = await fetchRangeRoadDistances(
    origin,
    samples,
  );

  if (!distances.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "routing_unavailable",
        reason: distances.reason,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const boundary = buildRangeBoundary(
    origin,
    rangeBudgetKm,
    samples,
    distances.distancesKm,
  );

  if (boundary.length < 4) {
    return NextResponse.json(
      {
        ok: false,
        error: "boundary_unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      vehicleId,
      origin,
      soc: status.soc,
      ratedRangeKm: status.ratedRangeKm,
      reserveSoc: RESERVE_SOC,
      rangeBudgetKm,
      boundary,
      osrmIsDefault: distances.osrmIsDefault,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
