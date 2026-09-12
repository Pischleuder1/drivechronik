import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { validateSession } from "../../../../lib/auth/session";
import { buildFullDataExport } from "../../../../lib/exports/fullDataExport";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = await getTranslations("exports");

  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error: t("errors.notAuthenticated"),
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const result = await buildFullDataExport();

  const body = new ArrayBuffer(
    result.bytes.byteLength,
  );
  new Uint8Array(body).set(result.bytes);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        `attachment; filename="${result.filename}"`,
      "Content-Length":
        String(result.bytes.byteLength),
      "Cache-Control":
        "private, no-store, max-age=0",
      "X-DriveChronik-Export-Format":
        "drivechronik-full-data-export",
      "X-DriveChronik-Export-Version":
        "1",
    },
  });
}
