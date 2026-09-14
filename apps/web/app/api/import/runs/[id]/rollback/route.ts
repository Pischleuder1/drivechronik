import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  ImportRollbackError,
  previewImportRollback,
  rollbackImportRun,
} from "@drivechronik/db";

import { validateSession } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseImportRunId(
  value: string,
): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

async function rollbackError(
  error: unknown,
) {
  const t = await getTranslations("import");

  if (error instanceof ImportRollbackError) {
    switch (error.code) {
      case "not_found":
        return NextResponse.json(
          { error: t("history.errors.notFound") },
          { status: 404 },
        );
      case "running":
        return NextResponse.json(
          { error: t("history.errors.running") },
          { status: 409 },
        );
      case "already_rolled_back":
        return NextResponse.json(
          { error: t("history.errors.alreadyRolledBack") },
          { status: 409 },
        );
    }
  }

  return NextResponse.json(
    { error: t("history.errors.unknown") },
    { status: 400 },
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error:
          t("apiErrors.notAuthenticated"),
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  const importRunId =
    parseImportRunId(id);

  if (importRunId == null) {
    return NextResponse.json(
      {
        error:
          t("history.errors.invalidId"),
      },
      { status: 400 },
    );
  }

  try {
    const preview =
      await previewImportRollback(
        db,
        importRunId,
      );

    return NextResponse.json({
      mode: "preview",
      preview,
    });
  } catch (error) {
    return rollbackError(error);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error:
          t("apiErrors.notAuthenticated"),
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  const importRunId =
    parseImportRunId(id);

  if (importRunId == null) {
    return NextResponse.json(
      {
        error:
          t("history.errors.invalidId"),
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          t("history.errors.confirmationMissing"),
      },
      { status: 400 },
    );
  }

  if (
    body == null ||
    typeof body !== "object" ||
    !("confirm" in body) ||
    body.confirm !== true
  ) {
    return NextResponse.json(
      {
        error:
          t("history.errors.confirmationRequired"),
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await rollbackImportRun(
        db,
        importRunId,
        {
          changedBy:
            user.username,
        },
      );

    return NextResponse.json({
      mode: "rollback",
      result,
    });
  } catch (error) {
    return rollbackError(error);
  }
}
