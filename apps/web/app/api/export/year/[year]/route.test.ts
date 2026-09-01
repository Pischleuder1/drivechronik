import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  getTranslations: vi.fn(),
  getLocale: vi.fn(),
  getBusinessReimbursementRateEurPerKm: vi.fn(),
  loadBusinessYearReportData: vi.fn(),
  buildBusinessYearExportLabels: vi.fn(),
  renderBusinessYearCsv: vi.fn(),
  renderBusinessYearPdf: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  getLocale: mocks.getLocale,
}));

vi.mock("../../../../../lib/auth/session", () => ({
  validateSession: mocks.validateSession,
}));

vi.mock("../../../../../lib/appSettings", () => ({
  getBusinessReimbursementRateEurPerKm:
    mocks.getBusinessReimbursementRateEurPerKm,
}));

vi.mock("../../../../../lib/exports/data", () => ({
  loadBusinessYearReportData: mocks.loadBusinessYearReportData,
}));

vi.mock("../../../../../lib/exports/businessYear", () => ({
  buildBusinessYearExportLabels:
    mocks.buildBusinessYearExportLabels,
  renderBusinessYearCsv: mocks.renderBusinessYearCsv,
  renderBusinessYearPdf: mocks.renderBusinessYearPdf,
}));

import { GET } from "./route";

function request(
  year: string,
  format: string | null,
): NextRequest {
  const url = new URL(
    `http://localhost/api/export/year/${year}`,
  );

  if (format != null) {
    url.searchParams.set("format", format);
  }

  return new NextRequest(url);
}

function context(year: string) {
  return {
    params: Promise.resolve({ year }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getTranslations.mockResolvedValue(
    (key: string) => key,
  );
  mocks.getLocale.mockResolvedValue("de-DE");

  mocks.validateSession.mockResolvedValue({
    id: 1,
    username: "tester",
  });

  mocks.getBusinessReimbursementRateEurPerKm
    .mockResolvedValue(0.3);

  mocks.loadBusinessYearReportData.mockResolvedValue({
    drives: [],
    meta: {
      vehicleName: "Model Y",
      generatedAt: new Date("2026-12-31T12:00:00Z"),
      timeZone: "Europe/Berlin",
    },
  });

  mocks.buildBusinessYearExportLabels.mockReturnValue({});

  mocks.renderBusinessYearCsv.mockReturnValue(
    "\ufeffMonat;Fahrten\r\nJanuar;0\r\n",
  );

  mocks.renderBusinessYearPdf.mockResolvedValue(
    Buffer.from("%PDF-1.7\nmock year report\n"),
  );
});

describe("GET /api/export/year/[year]", () => {
  it("returns 401 when no user is authenticated", async () => {
    mocks.validateSession.mockResolvedValue(null);

    const response = await GET(
      request("2026", "csv"),
      context("2026"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "errors.notAuthenticated",
    });

    expect(
      mocks.loadBusinessYearReportData,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid year", async () => {
    const response = await GET(
      request("1999", "csv"),
      context("1999"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "errors.invalidYear",
    });

    expect(
      mocks.loadBusinessYearReportData,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid format", async () => {
    const response = await GET(
      request("2026", "gpx"),
      context("2026"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "errors.invalidFormat",
    });

    expect(
      mocks.loadBusinessYearReportData,
    ).not.toHaveBeenCalled();
  });

  it("returns the annual CSV with download headers", async () => {
    const response = await GET(
      request("2026", "csv"),
      context("2026"),
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    );

    expect(
      response.headers.get("content-disposition"),
    ).toBe(
      'attachment; filename="drivechronik-jahr-2026-geschaeftlich.csv"',
    );

    const bytes = Buffer.from(await response.arrayBuffer());

    expect(bytes.subarray(0, 3)).toEqual(
      Buffer.from([0xef, 0xbb, 0xbf]),
    );

    expect(bytes.toString("utf8")).toContain("Januar;0");

    expect(
      mocks.loadBusinessYearReportData,
    ).toHaveBeenCalledWith("2026");

    expect(
      mocks.getBusinessReimbursementRateEurPerKm,
    ).toHaveBeenCalledOnce();

    expect(
      mocks.renderBusinessYearCsv,
    ).toHaveBeenCalledOnce();

    expect(
      mocks.renderBusinessYearPdf,
    ).not.toHaveBeenCalled();
  });

  it("returns the annual PDF with download headers", async () => {
    const response = await GET(
      request("2026", "pdf"),
      context("2026"),
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toBe(
      "application/pdf",
    );

    expect(
      response.headers.get("content-disposition"),
    ).toBe(
      'attachment; filename="drivechronik-jahr-2026-geschaeftlich.pdf"',
    );

    const body = Buffer.from(await response.arrayBuffer());

    expect(body.subarray(0, 4).toString("ascii")).toBe(
      "%PDF",
    );

    expect(
      mocks.renderBusinessYearPdf,
    ).toHaveBeenCalledOnce();

    expect(
      mocks.renderBusinessYearCsv,
    ).not.toHaveBeenCalled();
  });
});
