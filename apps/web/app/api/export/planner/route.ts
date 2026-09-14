import { NextRequest, NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";

import { validateSession } from "../../../../lib/auth/session";
import { renderPlannerPdf } from "../../../../lib/exports/plannerPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const coordinateSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]);

const ferrySchema = z.object({
  name: z.string().max(300),
  distanceKm: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
});

const stopSchema = z.object({
  id: z.string().max(300),
  name: z.string().max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  routeDistanceKm: z.number().nonnegative(),
  arrivalSoc: z.number(),
  departureSoc: z.number(),
  energyAddedKwh: z.number().nonnegative(),
  chargingMinutes: z.number().nonnegative(),
});

const plannerPdfSchema = z.object({
  routeLabel: z.string().max(300),
  startLabel: z.string().max(500),
  waypointLabels: z.array(z.string().max(500)).max(10),
  destinationLabel: z.string().max(500),

  distanceKm: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  totalChargingMinutes: z.number().nonnegative(),
  totalTravelSeconds: z.number().nonnegative(),

  avgSpeedKmh: z.number().nonnegative(),
  energyKwh: z.number().nonnegative(),
  whPerKm: z.number().nonnegative(),

  arrivalSoc: z.number(),
  plannedArrivalSoc: z.number().nullable(),

  chargingSiteCount: z.number().int().nonnegative(),
  chargingPlanComplete: z.boolean(),

  geometry: z.array(coordinateSchema).min(2).max(4000),

  mapImageDataUrl: z
    .string()
    .startsWith("data:image/")
    .max(4_000_000)
    .nullable()
    .optional(),

  ferrySegments: z.array(ferrySchema).max(20),
  recommendedChargingStops: z.array(stopSchema).max(30),
});

function filenamePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);

  return normalized || "route";
}

export async function POST(request: NextRequest) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Exportdaten." },
      { status: 400 },
    );
  }

  const parsed = plannerPdfSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Exportdaten." },
      { status: 400 },
    );
  }

  const locale = await getLocale();
  const pdf = await renderPlannerPdf(parsed.data, locale);

  const filename =
    `drivechronik-route-` +
    `${filenamePart(parsed.data.destinationLabel)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
