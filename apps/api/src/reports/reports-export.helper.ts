import { Readable } from "node:stream";
import { StreamableFile } from "@nestjs/common";
import type { AggregatedReportBucket, ExportFormat } from "./reports.types";

const HEADERS = [
  "หมวดหมู่ / ช่วงเวลา",
  "จำนวนดีล",
  "รายรับห้อง Owner (บาท)",
  "รายจ่ายห้อง Owner (บาท)",
  "รายได้สุทธิห้อง Owner (บาท)",
  "ค่านายหน้ารวม (บาท)",
  "ส่วนแบ่ง Agent (บาท)",
  "ส่วนแบ่งค่านายหน้าบริษัท (บาท)",
  "รายได้สุทธิบริษัท (บาท)",
  "ยอดค้างรับ (บาท)",
  "ยอดค้างจ่าย (บาท)",
];

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeXml(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bucketToCells(b: AggregatedReportBucket): Array<string | number> {
  return [
    b.label,
    b.dealsCount,
    b.ownerRevenue,
    b.ownerExpense,
    b.ownerNetIncome,
    b.totalCommission,
    b.agentShare,
    b.companyCommissionShare,
    b.companyNetIncome,
    b.receivables,
    b.payables,
  ];
}

export function buildReportExportStream(
  summary: {
    buckets: AggregatedReportBucket[];
    totals: Omit<AggregatedReportBucket, "key" | "label">;
  },
  format: ExportFormat,
): { file: StreamableFile; contentType: string; filename: string } {
  const totalBucket: AggregatedReportBucket = {
    key: "TOTAL",
    label: "รวมทั้งหมด",
    ...summary.totals,
  };
  const allRows = [...summary.buckets, totalBucket];

  if (format === "xlsx") {
    const headerXml = `<Row>${HEADERS.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("")}</Row>`;
    const bodyXml = allRows
      .map((b) => {
        const cells = bucketToCells(b);
        return `<Row>${cells
          .map((c, idx) => {
            const type = idx === 0 ? "String" : "Number";
            return `<Cell><Data ss:Type="${type}">${escapeXml(c)}</Data></Cell>`;
          })
          .join("")}</Row>`;
      })
      .join("\n");

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<?mso-application progid="Excel.Sheet"?>`,
      `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
      `<Worksheet ss:Name="รายงานสรุป RRS"><Table>`,
      headerXml,
      bodyXml,
      `</Table></Worksheet></Workbook>`,
    ].join("\n");

    const stream = Readable.from([Buffer.from(xml, "utf-8")]);
    return {
      file: new StreamableFile(stream),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8",
      filename: "rrs-report.xlsx",
    };
  }

  const lines = [
    HEADERS.map(escapeCsvCell).join(","),
    ...allRows.map((b) => bucketToCells(b).map(escapeCsvCell).join(",")),
  ];
  const csvWithBom = `\uFEFF${lines.join("\r\n")}\r\n`;
  const stream = Readable.from([Buffer.from(csvWithBom, "utf-8")]);
  return {
    file: new StreamableFile(stream),
    contentType: "text/csv; charset=utf-8",
    filename: "rrs-report.csv",
  };
}
