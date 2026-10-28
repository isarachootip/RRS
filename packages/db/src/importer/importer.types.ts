import type { PrismaClient } from "@prisma/client";

export type ImportEntity = "owners" | "assets" | "leads";

export interface ColumnMappingConfig {
  owners?: Record<string, string>;
  assets?: Record<string, string>;
  leads?: Record<string, string>;
}

export interface ImportIssue {
  rowNumber: number;
  status: "INVALID" | "DUPLICATE";
  reason: string;
  rawData: Record<string, string>;
}

export interface ImportResult {
  entity: ImportEntity;
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  issues: ImportIssue[];
  csvReport: string;
}

export interface RunLegacyImportOptions {
  entity: ImportEntity;
  csvContent: string;
  dryRun?: boolean;
  mapping?: Record<string, string>;
}

export const DEFAULT_COLUMN_MAPPINGS: Record<ImportEntity, Record<string, string>> = {
  owners: {
    code: "รหัส",
    fullName: "ชื่อ-นามสกุล",
    phone: "เบอร์โทร",
    lineId: "LINE ID",
    email: "อีเมล",
    agentEmail: "ผู้ดูแล",
    note: "หมายเหตุ",
  },
  assets: {
    code: "รหัส",
    category: "ประเภท",
    ownershipType: "กรรมสิทธิ์",
    ownerPhone: "เบอร์เจ้าของ",
    projectName: "โครงการ",
    unitNo: "เลขห้อง",
    rentPrice: "ราคาเช่า",
    salePrice: "ราคาขาย",
    agentEmail: "ผู้ดูแล",
  },
  leads: {
    code: "รหัส",
    intent: "ความต้องการ",
    fullName: "ชื่อ-นามสกุล",
    phone: "เบอร์โทร",
    lineId: "LINE ID",
    email: "อีเมล",
    source: "ช่องทาง",
    budgetMin: "งบต่ำสุด",
    budgetMax: "งบสูงสุด",
    preferredLocation: "ทำเล",
    agentEmail: "ผู้ดูแล",
  },
};

export function parseCsvRows(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? "").trim();
    });
    return record;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function getMappedField(row: Record<string, string>, field: string, mapping: Record<string, string>): string {
  const mappedHeader = mapping[field];
  if (mappedHeader && row[mappedHeader] !== undefined) {
    return row[mappedHeader]!;
  }
  return row[field] ?? "";
}

export function buildCsvReport(issues: ImportIssue[]): string {
  const header = "row_number,status,reason,raw_json";
  const rows = issues.map((iss) => {
    const escapedReason = `"${iss.reason.replace(/"/g, '""')}"`;
    const escapedRaw = `"${JSON.stringify(iss.rawData).replace(/"/g, '""')}"`;
    return `${iss.rowNumber},${iss.status},${escapedReason},${escapedRaw}`;
  });
  return [header, ...rows].join("\n");
}

function normalizeProjectKey(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "").trim();
}

export async function matchProjectFuzzy(prisma: PrismaClient, rawName: string): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, nameEn: true },
  });

  const targetKey = normalizeProjectKey(trimmed);
  for (const p of projects) {
    const nameKey = normalizeProjectKey(p.name);
    const enKey = p.nameEn ? normalizeProjectKey(p.nameEn) : "";
    if (nameKey === targetKey || enKey === targetKey || nameKey.includes(targetKey) || targetKey.includes(nameKey)) {
      return p.id;
    }
  }
  return null;
}
