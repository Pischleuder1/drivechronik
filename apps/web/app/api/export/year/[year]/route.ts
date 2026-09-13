import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import {
  buildBusinessYearReport,
  type Classification,
} from "@drivechronik/core";

import { validateSession } from "../../../../../lib/auth/session";
import { getBusinessReimbursementRateEurPerKm } from "../../../../../lib/appSettings";
import { loadBusinessYearReportData } from "../../../../../lib/exports/data";
import {
  buildBusinessYearExportLabels,
  renderBusinessYearCsv,
  renderBusinessYearPdf,
} from "../../../../../lib/exports/businessYear";
import { yearFilename } from "../../../../../lib/exports/filenames";
import {
  isValidFormat,
  isValidYearParam,
} from "../../../../../lib/exports/params";

export const dynamic = "force-dynamic";

const ALL_CLASSIFICATIONS: Classification[] = [
  "business",
  "private",
  "commute",
  "unclassified",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const t = await getTranslations("exports");

  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: t("errors.notAuthenticated") },
      { status: 401 },
    );
  }

  const { year } = await params;

  if (!isValidYearParam(year)) {
    return NextResponse.json(
      { error: t("errors.invalidYear") },
      { status: 400 },
    );
  }

  const format = request.nextUrl.searchParams.get("format");

  if (!isValidFormat(format)) {
    return NextResponse.json(
      { error: t("errors.invalidFormat") },
      { status: 400 },
    );
  }

  const classification =
    request.nextUrl.searchParams.get("classification");

  const businessOnly =
    classification == null || classification === "business";

  const selected: Classification[] = businessOnly
    ? ["business"]
    : ALL_CLASSIFICATIONS;

  const [data, reimbursementRate, locale] =
    await Promise.all([
      businessOnly
          ? loadBusinessYearReportData(year)
          : loadBusinessYearReportData(year, selected),
      getBusinessReimbursementRateEurPerKm(),
      getLocale(),
    ]);

  const report = buildBusinessYearReport(
    data.drives,
    year,
    data.meta,
    reimbursementRate,
    selected,
  );

  const labels = buildBusinessYearExportLabels(t, locale, !businessOnly);
  const filename = businessOnly
    ? yearFilename(year, format)
    : `drivechronik-jahr-${year}-alle-fahrten.${format}`;

  if (format === "csv") {
    const csv = renderBusinessYearCsv(report, labels);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="${filename}"`,
      },
    });
  }

  const pdf = await renderBusinessYearPdf(report, labels);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
    },
  });
}
