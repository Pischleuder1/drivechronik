import React from "react";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { stringify } from "csv-stringify/sync";
import type { getTranslations } from "next-intl/server";

import type { BusinessYearReport } from "@drivechronik/core";

const BOM = "﻿";
const DELIMITER = ";";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export interface BusinessYearExportLabels {
  locale: string;
  title: (year: string) => string;
  vehicle: string;
  month: string;
  drives: string;
  distance: string;
  rate: string;
  amount: string;
  total: string;
  incomplete: string;
  roundingNote: string;
  footer: (date: string) => string;
}

export function buildBusinessYearExportLabels(
  t: Translator,
  locale: string,
): BusinessYearExportLabels {
  return {
    locale,
    title: (year: string) => t("year.title", { year }),
    vehicle: t("year.vehicle"),
    month: t("year.month"),
    drives: t("year.drives"),
    distance: t("year.distance"),
    rate: t("year.rate"),
    amount: t("year.amount"),
    total: t("year.total"),
    incomplete: t("year.incomplete"),
    roundingNote: t("year.roundingNote"),
    footer: (date: string) => t("pdf.footer", { date }),
  };
}

function formatNumber(
  value: number,
  decimals: number,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatMonth(month: string, locale: string): string {
  const monthNumber = Number(month.slice(5, 7));

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, monthNumber - 1, 1, 12)));
}

export function renderBusinessYearCsv(
  report: BusinessYearReport,
  labels: BusinessYearExportLabels,
): string {
  const rows: string[][] = [];

  rows.push([labels.title(report.year)]);
  rows.push([labels.vehicle, report.meta.vehicleName]);
  rows.push([
    labels.rate,
    formatNumber(report.rateEurPerKm, 2, labels.locale),
    "EUR/km",
  ]);
  rows.push([]);

  rows.push([
    labels.month,
    labels.drives,
    labels.distance,
    labels.amount,
  ]);

  for (const month of report.months) {
    rows.push([
      formatMonth(month.month, labels.locale),
      String(month.driveCount),
      formatNumber(month.distanceKm, 1, labels.locale),
      formatNumber(month.amountEur, 2, labels.locale),
    ]);
  }

  rows.push([]);
  rows.push([
    labels.total,
    String(report.totals.driveCount),
    formatNumber(report.totals.distanceKm, 1, labels.locale),
    formatNumber(report.totals.amountEur, 2, labels.locale),
  ]);

  if (report.incomplete) {
    rows.push([]);
    rows.push([labels.incomplete]);
  }

  rows.push([]);
  rows.push([labels.roundingNote]);

  return (
    BOM +
    stringify(rows, {
      delimiter: DELIMITER,
      record_delimiter: "\r\n",
    })
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 5,
  },
  subHeader: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 18,
  },
  summary: {
    border: "1pt solid #cccccc",
    borderRadius: 4,
    padding: 10,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  table: {
    borderTop: "1pt solid #333333",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderBottom: "1pt solid #333333",
    paddingVertical: 5,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #dddddd",
    paddingVertical: 5,
  },
  totalRow: {
    flexDirection: "row",
    borderTop: "1pt solid #333333",
    paddingVertical: 6,
    fontWeight: 700,
  },
  monthCell: {
    width: "34%",
    paddingHorizontal: 4,
  },
  numberCell: {
    width: "22%",
    paddingHorizontal: 4,
    textAlign: "right",
  },
  note: {
    marginTop: 12,
    fontSize: 8,
    color: "#666666",
  },
  warning: {
    marginTop: 10,
    fontSize: 8,
    color: "#7a5200",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
  },
});

export function BusinessYearPdf({
  report,
  labels,
}: {
  report: BusinessYearReport;
  labels: BusinessYearExportLabels;
}) {
  const generatedAt = new Intl.DateTimeFormat(labels.locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(report.meta.generatedAt);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{labels.title(report.year)}</Text>

        <Text style={styles.subHeader}>
          {report.meta.vehicleName}
        </Text>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>{labels.distance}</Text>
            <Text>
              {formatNumber(
                report.totals.distanceKm,
                1,
                labels.locale,
              )}{" "}
              km
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text>{labels.drives}</Text>
            <Text>{report.totals.driveCount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text>{labels.rate}</Text>
            <Text>
              {formatNumber(
                report.rateEurPerKm,
                2,
                labels.locale,
              )}{" "}
              EUR/km
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={{ fontWeight: 700 }}>
              {labels.amount}
            </Text>
            <Text style={{ fontWeight: 700 }}>
              {formatNumber(
                report.totals.amountEur,
                2,
                labels.locale,
              )}{" "}
              EUR
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.monthCell}>{labels.month}</Text>
            <Text style={styles.numberCell}>{labels.drives}</Text>
            <Text style={styles.numberCell}>{labels.distance}</Text>
            <Text style={styles.numberCell}>{labels.amount}</Text>
          </View>

          {report.months.map((month) => (
            <View style={styles.tableRow} key={month.month}>
              <Text style={styles.monthCell}>
                {formatMonth(month.month, labels.locale)}
                {month.incomplete ? " *" : ""}
              </Text>

              <Text style={styles.numberCell}>
                {month.driveCount}
              </Text>

              <Text style={styles.numberCell}>
                {formatNumber(
                  month.distanceKm,
                  1,
                  labels.locale,
                )}{" "}
                km
              </Text>

              <Text style={styles.numberCell}>
                {formatNumber(
                  month.amountEur,
                  2,
                  labels.locale,
                )}{" "}
                EUR
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.monthCell}>{labels.total}</Text>
            <Text style={styles.numberCell}>
              {report.totals.driveCount}
            </Text>
            <Text style={styles.numberCell}>
              {formatNumber(
                report.totals.distanceKm,
                1,
                labels.locale,
              )}{" "}
              km
            </Text>
            <Text style={styles.numberCell}>
              {formatNumber(
                report.totals.amountEur,
                2,
                labels.locale,
              )}{" "}
              EUR
            </Text>
          </View>
        </View>

        {report.incomplete && (
          <Text style={styles.warning}>
            * {labels.incomplete}
          </Text>
        )}

        <Text style={styles.note}>
          {labels.roundingNote}
        </Text>

        <Text style={styles.footer}>
          {labels.footer(generatedAt)}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderBusinessYearPdf(
  report: BusinessYearReport,
  labels: BusinessYearExportLabels,
): Promise<Buffer> {
  return renderToBuffer(
    <BusinessYearPdf report={report} labels={labels} />,
  );
}
