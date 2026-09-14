import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import {
  buildMonthReport,
  type ReportMeta,
} from "@drivechronik/core";

import { validateSession } from "../../../../../../../lib/auth/session";
import { APP_TIMEZONE } from "../../../../../../../lib/config";
import {
  buildPdfLabels,
  renderSealedMonthPdf,
} from "../../../../../../../lib/exports/pdf";
import { isValidMonthParam } from "../../../../../../../lib/exports/params";
import { loadSealedMonth } from "../../../../../../../lib/sealedMonthLoader";

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
  const tErrors = await getTranslations(
    "reports.monthSeal.exportErrors",
  );
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: tErrors("notAuthenticated") },
      { status: 401 },
    );
  }

  const { month, revision: revisionParam } = await params;

  if (!isValidMonthParam(month)) {
    return NextResponse.json(
      { error: tErrors("invalidMonth") },
      { status: 400 },
    );
  }

  const revision = parsePositiveInteger(revisionParam);
  const vehicleId = parsePositiveInteger(
    request.nextUrl.searchParams.get("vehicleId"),
  );

  if (revision == null) {
    return NextResponse.json(
      { error: tErrors("invalidRevision") },
      { status: 400 },
    );
  }

  if (vehicleId == null) {
    return NextResponse.json(
      { error: tErrors("invalidVehicleId") },
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
            tErrors("notFound"),
        },
        { status: 404 },
      );
    }

    if (sealed.error === "snapshot_missing") {
      return NextResponse.json(
        {
          error:
            tErrors("snapshotMissingExport"),
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          tErrors("integrityFailed"),
        reason: sealed.error,
      },
      { status: 409 },
    );
  }

  const meta: ReportMeta = {
    vehicleName:
      sealed.content.identity.vehicleDisplayName,
    vehicleModel:
      sealed.content.identity.vehicleModel ?? null,
    driverName:
      sealed.content.identity.driverName,
    licensePlate:
      sealed.content.identity.licensePlate,
    vehicleVin:
      sealed.content.identity.vehicleVin,
    generatedAt: new Date(),
    timeZone: APP_TIMEZONE,
  };

  const report = buildMonthReport(
    sealed.drives,
    sealed.content.month,
    meta,
  );

  const [t, tCommon, locale] = await Promise.all([
    getTranslations("exports"),
    getTranslations("common"),
    getLocale(),
  ]);

  const pdf = await renderSealedMonthPdf(
    report,
    buildPdfLabels(t, tCommon, locale),
    {
      revision: sealed.row.revision,
      sealedAt: sealed.row.sealedAt,
      sealedBy: sealed.row.sealedBy,
      contentHash: sealed.row.contentHash,
      sealHash: sealed.row.sealHash,
      lastAuditHash: sealed.row.lastAuditHash,
      signatureStatus: sealed.signatureStatus,
      signingKeyId: sealed.signingKeyId,
    },
  );

  const filename =
    "fahrtenbuch-" +
    month +
    "-revision-" +
    revision +
    ".pdf";

  return new NextResponse(
    new Uint8Array(pdf),
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="' + filename + '"',
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}
