import type { AssetCategory, LeadIntent, LeadSource, OwnershipType, PrismaClient } from "@prisma/client";
import { normalizePhone } from "@rrs/shared";
import { nextCode } from "../index";
import {
  buildCsvReport,
  DEFAULT_COLUMN_MAPPINGS,
  getMappedField,
  matchProjectFuzzy,
  parseCsvRows,
  type ImportIssue,
  type ImportResult,
  type RunLegacyImportOptions,
} from "./importer.types";

export async function runLegacyImport(prisma: PrismaClient, opts: RunLegacyImportOptions): Promise<ImportResult> {
  const dryRun = Boolean(opts.dryRun);
  const mapping = { ...DEFAULT_COLUMN_MAPPINGS[opts.entity], ...(opts.mapping ?? {}) };
  const rows = parseCsvRows(opts.csvContent);
  const issues: ImportIssue[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let importedRows = 0;

  const addIssue = (
    rowNumber: number,
    status: "INVALID" | "DUPLICATE",
    reason: string,
    rawData: Record<string, string>,
  ) => {
    if (status === "INVALID") invalidRows++;
    else duplicateRows++;
    issues.push({ rowNumber, status, reason, rawData });
  };

  const findContactWhere = (phone: string | null, email: string | null, lineId: string | null) => [
    ...(phone ? [{ phone }] : []),
    ...(email ? [{ email }] : []),
    ...(lineId ? [{ lineId }] : []),
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 2;

    if (opts.entity === "owners") {
      const fullName = getMappedField(row, "fullName", mapping);
      const rawPhone = getMappedField(row, "phone", mapping);
      const lineId = getMappedField(row, "lineId", mapping) || null;
      const email = getMappedField(row, "email", mapping) || null;
      const agentEmail = getMappedField(row, "agentEmail", mapping);
      const phone = rawPhone ? normalizePhone(rawPhone) : null;

      if (!fullName) {
        addIssue(rowNumber, "INVALID", "ไม่มีชื่อ-นามสกุล", row);
        continue;
      }

      const dupWhere = findContactWhere(phone, email, lineId);
      const existing =
        dupWhere.length > 0
          ? await prisma.owner.findFirst({ where: { archivedAt: null, OR: dupWhere } })
          : await prisma.owner.findFirst({ where: { archivedAt: null, fullName } });

      if (existing) {
        addIssue(rowNumber, "DUPLICATE", `ซ้ำกับเจ้าของทรัพย์รหัส ${existing.code}`, row);
        continue;
      }

      validRows++;
      if (!dryRun) {
        const agent = agentEmail ? await prisma.user.findUnique({ where: { email: agentEmail } }) : null;
        const code = await nextCode(prisma, "OW", "OW-");
        await prisma.owner.create({
          data: { code, fullName, phone, lineId, email, agentId: agent?.id ?? null },
        });
        importedRows++;
      }
      continue;
    }

    if (opts.entity === "assets") {
      const category = (getMappedField(row, "category", mapping) || "CONDO") as AssetCategory;
      const ownershipType = (getMappedField(row, "ownershipType", mapping) || "AGENT") as OwnershipType;
      const rawOwnerPhone = getMappedField(row, "ownerPhone", mapping);
      const projectName = getMappedField(row, "projectName", mapping);
      const unitNo = getMappedField(row, "unitNo", mapping);
      const rentPriceStr = getMappedField(row, "rentPrice", mapping);
      const salePriceStr = getMappedField(row, "salePrice", mapping);
      const agentEmail = getMappedField(row, "agentEmail", mapping);

      if (!unitNo) {
        addIssue(rowNumber, "INVALID", "ไม่มีเลขห้อง", row);
        continue;
      }

      const ownerPhone = rawOwnerPhone ? normalizePhone(rawOwnerPhone) : null;
      const owner = ownerPhone
        ? await prisma.owner.findFirst({ where: { phone: ownerPhone, archivedAt: null } })
        : await prisma.owner.findFirst({ where: { isCompany: true } });

      if (!owner) {
        addIssue(rowNumber, "INVALID", "ไม่พบเจ้าของทรัพย์", row);
        continue;
      }

      const projectId = await matchProjectFuzzy(prisma, projectName);
      const existing = await prisma.asset.findFirst({
        where: { archivedAt: null, unitNo, ...(projectId ? { projectId } : { ownerId: owner.id }) },
      });

      if (existing) {
        addIssue(rowNumber, "DUPLICATE", `ซ้ำกับสินทรัพย์รหัส ${existing.code}`, row);
        continue;
      }

      validRows++;
      if (!dryRun) {
        const agent = agentEmail ? await prisma.user.findUnique({ where: { email: agentEmail } }) : null;
        const code = await nextCode(prisma, "PR", "PR-");
        await prisma.asset.create({
          data: {
            code,
            category,
            ownershipType,
            ownerId: owner.id,
            projectId,
            unitNo,
            rentPrice: rentPriceStr ? Number(rentPriceStr) : null,
            salePrice: salePriceStr ? Number(salePriceStr) : null,
            primaryAgentId: agent?.id ?? null,
          },
        });
        importedRows++;
      }
      continue;
    }

    // leads
    const fullName = getMappedField(row, "fullName", mapping);
    const rawPhone = getMappedField(row, "phone", mapping);
    const lineId = getMappedField(row, "lineId", mapping) || null;
    const email = getMappedField(row, "email", mapping) || null;
    const intent = (getMappedField(row, "intent", mapping) || "RENT") as LeadIntent;
    const source = (getMappedField(row, "source", mapping) || "OTHER") as LeadSource;
    const agentEmail = getMappedField(row, "agentEmail", mapping);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;

    if (!fullName) {
      addIssue(rowNumber, "INVALID", "ไม่มีชื่อลูกค้า", row);
      continue;
    }

    const dupWhere = findContactWhere(phone, email, lineId);
    const existing =
      dupWhere.length > 0
        ? await prisma.lead.findFirst({ where: { archivedAt: null, OR: dupWhere } })
        : await prisma.lead.findFirst({ where: { archivedAt: null, fullName } });

    if (existing) {
      addIssue(rowNumber, "DUPLICATE", `ซ้ำกับลูกค้ารหัส ${existing.code}`, row);
      continue;
    }

    validRows++;
    if (!dryRun) {
      const agent =
        (agentEmail ? await prisma.user.findUnique({ where: { email: agentEmail } }) : null) ??
        (await prisma.user.findFirstOrThrow({ where: { isActive: true } }));
      const code = await nextCode(prisma, "LD", "LD-");
      await prisma.lead.create({
        data: { code, intent, fullName, phone, lineId, email, source, ownerAgentId: agent.id },
      });
      importedRows++;
    }
  }

  return {
    entity: opts.entity,
    dryRun,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    importedRows,
    issues,
    csvReport: buildCsvReport(issues),
  };
}
