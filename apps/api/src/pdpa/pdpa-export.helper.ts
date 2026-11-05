import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import {
  ANONYMIZED_NAME,
  type PdpaExportPayload,
  type PdpaSubjectItem,
  type PdpaSubjectType,
  type SearchPdpaSubjectsQuery,
} from "./pdpa.types";

export async function searchPdpaSubjects(
  prisma: PrismaService,
  query: SearchPdpaSubjectsQuery,
): Promise<{ items: PdpaSubjectItem[] }> {
  const q = query.q?.trim();
  const includeAnonymized = query.includeAnonymized === "true";
  const items: PdpaSubjectItem[] = [];
  const textFilter = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { fullName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { lineId: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const whereBase = { ...(includeAnonymized ? {} : { fullName: { not: ANONYMIZED_NAME } }), ...textFilter };

  if (!query.type || query.type === "LEAD") {
    const leads = await prisma.lead.findMany({ where: whereBase, orderBy: { updatedAt: "desc" }, take: 50 });
    items.push(
      ...leads.map((l) => ({
        id: l.id,
        subjectType: "LEAD" as const,
        code: l.code,
        fullName: l.fullName,
        phone: l.phone,
        lineId: l.lineId,
        email: l.email,
        status: l.status,
        consentAt: l.consentAt?.toISOString() ?? null,
        lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
        updatedAt: l.updatedAt.toISOString(),
        isAnonymized: l.fullName === ANONYMIZED_NAME,
      })),
    );
  }

  if (!query.type || query.type === "OWNER") {
    const owners = await prisma.owner.findMany({ where: whereBase, orderBy: { updatedAt: "desc" }, take: 50 });
    items.push(
      ...owners.map((o) => ({
        id: o.id,
        subjectType: "OWNER" as const,
        code: o.code,
        fullName: o.fullName,
        phone: o.phone,
        lineId: o.lineId,
        email: o.email,
        status: o.status,
        consentAt: null,
        lastActivityAt: null,
        updatedAt: o.updatedAt.toISOString(),
        isAnonymized: o.fullName === ANONYMIZED_NAME,
      })),
    );
  }

  return { items };
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function mapContracts(
  contracts: Array<{ id: string; contractNo: string; status: string; startDate: Date; endDate: Date }>,
) {
  return contracts.map((c) => ({
    id: c.id,
    contractNo: c.contractNo,
    status: c.status,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
  }));
}

export async function loadPdpaExportPayload(
  prisma: PrismaService,
  subjectType: PdpaSubjectType,
  id: string,
): Promise<PdpaExportPayload> {
  if (subjectType === "LEAD") {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { activities: { orderBy: { createdAt: "desc" } }, contracts: { orderBy: { createdAt: "desc" } } },
    });
    if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });
    return {
      exportedAt: new Date().toISOString(),
      subjectType: "LEAD",
      subject: {
        id: lead.id,
        code: lead.code,
        fullName: lead.fullName,
        phone: lead.phone,
        lineId: lead.lineId,
        email: lead.email,
        status: lead.status,
        consentAt: lead.consentAt?.toISOString() ?? null,
        consentText: lead.consentText,
        createdAt: lead.createdAt.toISOString(),
      },
      activities: lead.activities.map((a) => ({
        id: a.id,
        type: a.type,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
      })),
      contracts: mapContracts(lead.contracts),
    };
  }

  const owner = await prisma.owner.findUnique({
    where: { id },
    include: { contracts: { orderBy: { createdAt: "desc" } } },
  });
  if (!owner) throw new NotFoundException({ code: "OWNER_NOT_FOUND", message: "ไม่พบข้อมูลเจ้าของทรัพย์" });
  return {
    exportedAt: new Date().toISOString(),
    subjectType: "OWNER",
    subject: {
      id: owner.id,
      code: owner.code,
      fullName: owner.fullName,
      phone: owner.phone,
      lineId: owner.lineId,
      email: owner.email,
      status: owner.status,
      consentAt: null,
      consentText: null,
      createdAt: owner.createdAt.toISOString(),
    },
    activities: [],
    contracts: mapContracts(owner.contracts),
  };
}

export function buildPdpaPdfBuffer(payload: PdpaExportPayload): Buffer {
  const lines = [
    "RRS PDPA Personal Data Export (DSR)",
    `Exported At: ${payload.exportedAt}`,
    `Subject Type: ${payload.subjectType}`,
    `Code: ${payload.subject.code}`,
    `Full Name: ${payload.subject.fullName}`,
    `Phone: ${payload.subject.phone ?? "-"}`,
    `LINE ID: ${payload.subject.lineId ?? "-"}`,
    `Email: ${payload.subject.email ?? "-"}`,
    `Status: ${payload.subject.status}`,
    `Consent At: ${payload.subject.consentAt ?? "-"}`,
    `Activities Count: ${payload.activities.length}`,
    `Contracts Count: ${payload.contracts.length}`,
  ];

  const streamBody = [
    "BT",
    "/F1 12 Tf",
    "50 760 Td",
    "16 TL",
    ...lines.map((l, i) => `${i === 0 ? "" : "T* "}(${escapePdfText(l)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, "utf8")} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  const header = "%PDF-1.4\n";
  let offset = Buffer.byteLength(header, "utf8");
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(offset);
    offset += Buffer.byteLength(obj, "utf8");
  }

  const xrefRows = ["0000000000 65535 f \n"];
  for (const pos of offsets) {
    xrefRows.push(`${String(pos).padStart(10, "0")} 00000 n \n`);
  }

  const xref = `xref\n0 ${objects.length + 1}\n${xrefRows.join("")}`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;

  return Buffer.from(header + objects.join("") + xref + trailer, "utf8");
}
