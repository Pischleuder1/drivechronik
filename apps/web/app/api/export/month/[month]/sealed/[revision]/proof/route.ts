import { NextRequest, NextResponse } from "next/server";

import { validateSession } from "../../../../../../../../lib/auth/session";
import { isValidMonthParam } from "../../../../../../../../lib/exports/params";
import { loadSealedMonth } from "../../../../../../../../lib/sealedMonthLoader";

export const dynamic = "force-dynamic";

function parsePositiveInteger(
  value: string | null | undefined,
): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      month: string;
      revision: string;
    }>;
  },
) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  const { month, revision: revisionParam } = await params;

  if (!isValidMonthParam(month)) {
    return NextResponse.json(
      { error: "Ungültiger Monat." },
      { status: 400 },
    );
  }

  const revision = parsePositiveInteger(revisionParam);

  const vehicleId = parsePositiveInteger(
    request.nextUrl.searchParams.get("vehicleId"),
  );

  if (revision == null) {
    return NextResponse.json(
      { error: "Ungültige Revision." },
      { status: 400 },
    );
  }

  if (vehicleId == null) {
    return NextResponse.json(
      { error: "Ungültige oder fehlende Fahrzeug-ID." },
      { status: 400 },
    );
  }

  const sealed = await loadSealedMonth(
    vehicleId,
    month,
    revision,
  );

  if (!sealed.ok) {
    if (sealed.error === "not_found") {
      return NextResponse.json(
        {
          error:
            "Der angeforderte Monatsabschluss wurde nicht gefunden.",
        },
        { status: 404 },
      );
    }

    if (sealed.error === "snapshot_missing") {
      return NextResponse.json(
        {
          error:
            "Für diese ältere Revision wurde noch kein vollständiger Snapshot gespeichert.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Die Integritätsprüfung des Monatsabschlusses ist fehlgeschlagen.",
        reason: sealed.error,
      },
      { status: 409 },
    );
  }

  const proof = {
    format: "drivechronik-month-seal-proof",
    version: 1,
    month: sealed.row.month,
    vehicleId: sealed.row.vehicleId,
    revision: sealed.row.revision,

    sealedAt: sealed.row.sealedAt.toISOString(),
    sealedBy: sealed.row.sealedBy,

    identity: {
      driverName: sealed.row.driverName,
      licensePlate: sealed.row.licensePlate,
      vehicleDisplayName: sealed.row.vehicleDisplayName,
      vehicleVin: sealed.row.vehicleVin,
    },

    totals: {
      driveCount: sealed.row.driveCount,
      distanceKm: sealed.row.distanceKm,
    },

    integrity: {
      contentHash: sealed.row.contentHash,
      lastAuditHash: sealed.row.lastAuditHash,
      sealHash: sealed.row.sealHash,
    },

    signature: {
      status: sealed.signatureStatus,
      algorithm: sealed.row.signatureAlgorithm,
      value: sealed.row.signature,
      publicKey: sealed.row.signingPublicKey,
      keyId: sealed.signingKeyId,
    },

    snapshot: sealed.content,
  };

  const filename =
    "fahrtenbuch-" +
    month +
    "-revision-" +
    revision +
    "-proof.json";

  return NextResponse.json(
    proof,
    {
      headers: {
        "Content-Disposition":
          'attachment; filename="' + filename + '"',
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}
