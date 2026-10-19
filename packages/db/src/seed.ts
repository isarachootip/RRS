/**
 * ข้อมูลตัวอย่างสำหรับพัฒนาและทดสอบ (ห้ามใช้กับ production)
 * - 4 บทบาท + สิทธิ์เริ่มต้นตาม @rrs/shared DEFAULT_ROLE_PERMISSIONS
 * - ผู้ใช้บทบาทละ 2 คน, 2 ทีม
 * - เจ้าของ "บริษัท" 1 รายการ + เจ้าของทรัพย์ 10 ราย
 * - 30 สินทรัพย์หลายประเภท, 50 lead, กฎแจ้งเตือนตาม design ข้อ 7
 * ข้อมูลสุ่มแบบกำหนด seed ตายตัว — รันกี่ครั้งก็ได้ผลเหมือนเดิม
 * ผู้ใช้ตัวอย่างทุกคนใช้รหัสผ่าน SEED_PASSWORD (Admin และ Accounting ต้องตั้ง 2FA ตอนล็อกอินครั้งแรก)
 */
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  normalizePhone,
  parseAssetAttributes,
  type AssetCategory as SharedCategory,
  type RoleCode,
} from "@rrs/shared";
import {
  AssetCategory,
  AssetStatus,
  LeadIntent,
  LeadSource,
  LeadStatus,
  OwnershipType,
  Prisma,
  RoomType,
  type PrismaClient,
} from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { nextCode } from "./index";

/** mulberry32 — PRNG แบบกำหนด seed */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T>(xs: readonly T[]): T => {
    const x = xs[int(0, xs.length - 1)];
    if (x === undefined) throw new Error("pick from empty array");
    return x;
  };
  return { next, int, pick };
}

const FIRST = [
  "สมชาย",
  "สมหญิง",
  "วิชัย",
  "สุดา",
  "ประเสริฐ",
  "กานดา",
  "อนุชา",
  "พิมพ์ชนก",
  "ธนพล",
  "ณัฐธิดา",
  "ชัยวัฒน์",
  "ศิริพร",
  "กิตติ",
  "วรรณา",
  "ปิยะ",
  "จันทร์เพ็ญ",
];
const LAST = [
  "ใจดี",
  "รักษ์ไทย",
  "ศรีสุข",
  "บุญมา",
  "ทองคำ",
  "แก้วมณี",
  "วงศ์ใหญ่",
  "สายสุวรรณ",
  "พงษ์ไพร",
  "มีทรัพย์",
  "เจริญผล",
  "อินทร์แก้ว",
];
const FOREIGN = ["John Smith", "Akira Tanaka", "Li Wei", "Anna Müller", "Kim Min-jun", "Priya Sharma"];

const PROJECTS = [
  {
    name: "เดอะ ริเวอร์ไซด์ เรสซิเดนซ์ (ตัวอย่าง)",
    nameEn: "The Riverside Residence (Sample)",
    district: "คลองสาน",
    transit: ["BTS กรุงธนบุรี"],
  },
  {
    name: "สุขุมวิท พาร์ค วิว (ตัวอย่าง)",
    nameEn: "Sukhumvit Park View (Sample)",
    district: "วัฒนา",
    transit: ["BTS อ่อนนุช"],
  },
  {
    name: "พระราม 9 ซิตี้ ลอฟท์ (ตัวอย่าง)",
    nameEn: "Rama 9 City Loft (Sample)",
    district: "ห้วยขวาง",
    transit: ["MRT พระราม 9"],
  },
  { name: "อารีย์ การ์เด้น (ตัวอย่าง)", nameEn: "Ari Garden (Sample)", district: "พญาไท", transit: ["BTS อารีย์"] },
  {
    name: "บางนา เทรด คอนโด (ตัวอย่าง)",
    nameEn: "Bangna Trade Condo (Sample)",
    district: "บางนา",
    transit: ["BTS บางนา"],
  },
  {
    name: "ลาดพร้าว สเตชั่น (ตัวอย่าง)",
    nameEn: "Ladprao Station (Sample)",
    district: "จตุจักร",
    transit: ["MRT ลาดพร้าว"],
  },
] as const;

const NOTIFICATION_RULES: Prisma.NotificationRuleCreateInput[] = [
  { event: "lead.created", description: "มีลูกค้าใหม่เข้าระบบ", recipients: ["TEAM_MANAGER"], channels: ["IN_APP"] },
  {
    event: "lead.assigned",
    description: "มอบหมาย/โอนลูกค้า",
    recipients: ["NEW_OWNER", "PREVIOUS_OWNER"],
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "lead.duplicate_detected",
    description: "Agent อื่นกำลังดูแลลูกค้ารายเดียวกัน",
    recipients: ["ACTOR", "LEAD_OWNER"],
    channels: ["IN_APP"],
  },
  {
    event: "lead.inactive",
    description: "ลูกค้าไม่มีกิจกรรมเกินกำหนด",
    recipients: ["TEAM_MANAGER"],
    timing: { inactiveDays: 30 },
    channels: ["IN_APP"],
  },
  {
    event: "appointment.reminder",
    description: "ใกล้ถึงเวลานัดดูห้อง",
    recipients: ["APPOINTMENT_AGENT", "APPOINTMENT_COORDINATOR"],
    timing: { minutesBefore: [1440, 120] },
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "appointment.changed",
    description: "เลื่อนหรือยกเลิกนัด",
    recipients: ["APPOINTMENT_PARTICIPANTS"],
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "followup.due",
    description: "ถึง/เลยกำหนดติดตามลูกค้า",
    recipients: ["LEAD_OWNER"],
    timing: { atHour: 9, escalateToManagerAfterDays: 1 },
    channels: ["IN_APP"],
  },
  {
    event: "booking.created",
    description: "มีการจองห้อง",
    recipients: ["TEAM_MANAGER", "ASSET_AGENT", "ACCOUNTING"],
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "contract.expiring",
    description: "ใกล้หมดสัญญาเช่า",
    recipients: ["ASSET_AGENT", "TEAM_MANAGER"],
    timing: { daysBefore: [90, 60, 30] },
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "listing_agreement.expiring",
    description: "ใกล้หมดสัญญาฝากเช่า/ฝากขาย",
    recipients: ["ASSET_AGENT", "TEAM_MANAGER"],
    timing: { daysBefore: [90, 60, 30] },
    channels: ["IN_APP"],
  },
  {
    event: "commission.due",
    description: "ถึงกำหนดรับหรือจ่ายค่านายหน้า",
    recipients: ["ACCOUNTING"],
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "approval.pending",
    description: "มีรายการรออนุมัติ",
    recipients: ["APPROVER"],
    timing: { dailyDigestHour: 9 },
    channels: ["IN_APP", "EMAIL"],
  },
];

/** รหัสผ่านของผู้ใช้ตัวอย่างทุกคน — ใช้เฉพาะเครื่องพัฒนา */
export const SEED_PASSWORD = "RrsDev#2026";
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const money = (n: number) => new Prisma.Decimal(n.toFixed(2));

export interface SeedResult {
  users: number;
  owners: number;
  assets: number;
  leads: number;
}

export async function seed(prisma: PrismaClient): Promise<SeedResult> {
  const r = rng(20261019);

  // ---------- สิทธิ์และบทบาท (upsert ได้ทุกครั้ง) ----------
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description, module: code.split(".")[0] ?? code },
    });
  }
  const roleNames: Record<RoleCode, string> = {
    ADMIN: "ผู้ดูแลระบบ",
    MANAGER: "ผู้จัดการทีม",
    AGENT: "เอเจนต์",
    ACCOUNTING: "บัญชี",
  };
  const roles = {} as Record<RoleCode, string>;
  for (const code of Object.keys(roleNames) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, name: roleNames[code], isSystem: true },
    });
    roles[code] = role.id;
    for (const [perm, scope] of Object.entries(DEFAULT_ROLE_PERMISSIONS[code])) {
      const p = await prisma.permission.findUniqueOrThrow({ where: { code: perm } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id, scope },
      });
    }
  }
  for (const rule of NOTIFICATION_RULES) {
    await prisma.notificationRule.upsert({ where: { event: rule.event }, update: {}, create: rule });
  }

  // ข้อมูลตัวอย่างสร้างครั้งเดียว
  if ((await prisma.asset.count()) > 0) {
    return {
      users: await prisma.user.count(),
      owners: await prisma.owner.count(),
      assets: await prisma.asset.count(),
      leads: await prisma.lead.count(),
    };
  }

  // ---------- ทีมและผู้ใช้ ----------
  const passwordHash = await hash(SEED_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const teamA = await prisma.team.create({ data: { name: "ทีมสุขุมวิท" } });
  const teamB = await prisma.team.create({ data: { name: "ทีมพระราม 9" } });
  const mkUser = async (email: string, fullName: string, role: RoleCode, teamId?: string, isFreelance = false) =>
    prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        teamId,
        isFreelance,
        phone: normalizePhone(`08${r.int(10000000, 99999999)}`),
        roles: { create: { roleId: roles[role] } },
      },
    });

  await mkUser("admin1@rrs.local", "แอดมิน หนึ่ง", "ADMIN");
  await mkUser("admin2@rrs.local", "แอดมิน สอง", "ADMIN");
  const mgrA = await mkUser("manager1@rrs.local", "ผู้จัดการ สุขุมวิท", "MANAGER", teamA.id);
  const mgrB = await mkUser("manager2@rrs.local", "ผู้จัดการ พระราม 9", "MANAGER", teamB.id);
  const agentA = await mkUser("agent1@rrs.local", "เอเจนต์ เอ", "AGENT", teamA.id);
  const agentB = await mkUser("agent2@rrs.local", "เอเจนต์ บี", "AGENT", teamB.id, true);
  await mkUser("accounting1@rrs.local", "บัญชี หนึ่ง", "ACCOUNTING");
  await mkUser("accounting2@rrs.local", "บัญชี สอง", "ACCOUNTING");
  await prisma.team.update({ where: { id: teamA.id }, data: { managerId: mgrA.id } });
  await prisma.team.update({ where: { id: teamB.id }, data: { managerId: mgrB.id } });
  const agents = [agentA, agentB];

  // ---------- โครงการ ----------
  const projects = [];
  for (const p of PROJECTS) {
    projects.push(
      await prisma.project.create({
        data: {
          name: p.name,
          nameEn: p.nameEn,
          district: p.district,
          province: "กรุงเทพมหานคร",
          nearTransit: [...p.transit],
        },
      }),
    );
  }

  // ---------- เจ้าของทรัพย์ ----------
  const company = await prisma.owner.create({
    data: {
      code: await nextCode(prisma, "OW", "OW-"),
      isCompany: true,
      fullName: "บริษัท (ทรัพย์สินของบริษัท)",
      status: "LISTED",
    },
  });
  const owners = [];
  for (let i = 0; i < 10; i++) {
    owners.push(
      await prisma.owner.create({
        data: {
          code: await nextCode(prisma, "OW", "OW-"),
          fullName: `${r.pick(FIRST)} ${r.pick(LAST)}`,
          phone: normalizePhone(`08${r.int(10000000, 99999999)}`),
          lineId: r.next() < 0.7 ? `owner${i + 1}` : null,
          email: r.next() < 0.5 ? `owner${i + 1}@example.com` : null,
          sourceChannel: r.pick([LeadSource.FACEBOOK, LeadSource.REFERRAL, LeadSource.WEBSITE, LeadSource.LINE]),
          firstContactAt: d(`2026-0${r.int(1, 9)}-1${r.int(0, 9)}`),
          agentId: r.pick(agents).id,
          status: i < 8 ? "LISTED" : r.pick(["NEW", "CONTACTED"] as const),
        },
      }),
    );
  }

  // ---------- สินทรัพย์ 30 รายการ ----------
  type Spec = { category: SharedCategory; count: number };
  const specs: Spec[] = [
    { category: "CONDO", count: 14 },
    { category: "HOUSE", count: 3 },
    { category: "TOWNHOME", count: 2 },
    { category: "APARTMENT_BUILDING", count: 1 },
    { category: "APARTMENT_UNIT", count: 5 },
    { category: "FACTORY", count: 2 },
    { category: "WAREHOUSE", count: 2 },
    { category: "LAND", count: 1 },
  ];
  const sampleAttributes = (c: SharedCategory): Record<string, unknown> => {
    switch (c) {
      case "CONDO":
        return { commonFeePerSqm: r.pick([40, 50, 60, 70]), parkingSlots: r.int(0, 1) };
      case "HOUSE":
      case "TOWNHOME":
        return {
          land: { rai: 0, ngan: r.int(0, 1), sqWah: r.int(18, 80) },
          stories: r.int(2, 3),
          parkingSlots: r.int(1, 2),
        };
      case "APARTMENT_BUILDING":
        return { land: { rai: 0, ngan: 2, sqWah: 0 }, totalUnits: 40, totalFloors: 5, occupancyRatePercent: 85 };
      case "APARTMENT_UNIT":
        return { waterRatePerUnit: 18, electricRatePerUnit: 7, allowsDailyRent: false };
      case "FACTORY":
      case "WAREHOUSE":
        return {
          land: { rai: r.int(1, 5), ngan: 0, sqWah: 0 },
          buildingAreaSqm: r.int(800, 4000),
          powerKva: r.pick([250, 500, 1000]),
          ceilingHeightM: r.pick([8, 10, 12]),
          hasFactoryLicense: c === "FACTORY",
        };
      case "LAND":
        return { land: { rai: 3, ngan: 1, sqWah: 50 }, titleDeedType: "CHANOTE", frontageM: 40 };
      default:
        return {};
    }
  };

  let building: { id: string } | null = null;
  const assets: { id: string; category: SharedCategory; agentId: string | null; ownership: OwnershipType }[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const isCompanyOwned =
        spec.category === "APARTMENT_BUILDING" || spec.category === "APARTMENT_UNIT" || r.next() < 0.3;
      const owner = isCompanyOwned ? company : r.pick(owners);
      const ownership = isCompanyOwned ? OwnershipType.OWNER : OwnershipType.AGENT;
      const agent = r.pick(agents);
      const isCondo = spec.category === "CONDO";
      const isUnit = spec.category === "APARTMENT_UNIT";
      const project = isCondo ? r.pick(projects) : null;
      const roomType = isCondo
        ? r.pick([RoomType.STUDIO, RoomType.ONE_BEDROOM, RoomType.ONE_BEDROOM, RoomType.TWO_BEDROOMS])
        : isUnit
          ? RoomType.STUDIO
          : null;
      const bedrooms =
        roomType === RoomType.STUDIO
          ? 0
          : roomType === RoomType.ONE_BEDROOM
            ? 1
            : roomType === RoomType.TWO_BEDROOMS
              ? 2
              : spec.category === "HOUSE" || spec.category === "TOWNHOME"
                ? r.int(2, 4)
                : null;
      const area = isCondo
        ? r.int(24, 75)
        : isUnit
          ? r.int(22, 30)
          : spec.category === "HOUSE"
            ? r.int(150, 300)
            : spec.category === "TOWNHOME"
              ? r.int(110, 180)
              : null;
      const rent = isCondo
        ? r.int(9, 45) * 1000
        : isUnit
          ? r.int(5, 8) * 1000
          : spec.category === "HOUSE"
            ? r.int(30, 90) * 1000
            : spec.category === "TOWNHOME"
              ? r.int(18, 35) * 1000
              : spec.category === "FACTORY" || spec.category === "WAREHOUSE"
                ? r.int(80, 400) * 1000
                : null;
      const forSale = !isUnit && spec.category !== "APARTMENT_BUILDING" && r.next() < 0.35;
      const salePrice = forSale
        ? (rent ?? 50000) * r.int(150, 220)
        : spec.category === "LAND"
          ? 45_000_000
          : spec.category === "APARTMENT_BUILDING"
            ? 38_000_000
            : null;
      const status = r.pick([
        AssetStatus.AVAILABLE,
        AssetStatus.AVAILABLE,
        AssetStatus.AVAILABLE,
        AssetStatus.VIEWING_SCHEDULED,
        AssetStatus.NEGOTIATING,
        AssetStatus.CONTRACTED,
      ]);
      const attributes = parseAssetAttributes(spec.category, sampleAttributes(spec.category));

      if (isUnit && !building) {
        building = await prisma.building.create({
          data: { name: "อพาร์ตเมนต์ตัวอย่าง ลาดพร้าว 101", ownerId: company.id, totalFloors: 5 },
        });
      }

      const asset = await prisma.asset.create({
        data: {
          code: await nextCode(prisma, "PR", "PR-"),
          category: spec.category as AssetCategory,
          ownershipType: ownership,
          ownerId: owner.id,
          projectId: project?.id,
          buildingId: isUnit ? building?.id : undefined,
          tower: isCondo ? r.pick(["A", "B", "C"]) : null,
          unitNo: isCondo
            ? `${r.int(2, 35)}${String(r.int(1, 20)).padStart(2, "0")}`
            : isUnit
              ? `${i + 2}0${i + 1}`
              : null,
          floor: isCondo ? r.int(2, 35) : isUnit ? i + 2 : null,
          district: project?.district ?? r.pick(["บางพลี", "ลาดกระบัง", "บางบัวทอง", "ลาดพร้าว"]),
          province: spec.category === "FACTORY" || spec.category === "WAREHOUSE" ? "สมุทรปราการ" : "กรุงเทพมหานคร",
          areaSqm: area ? money(area) : null,
          roomType,
          bedrooms,
          bathrooms: bedrooms === null ? null : Math.max(1, bedrooms),
          furniture: isCondo || isUnit ? "เฟอร์นิเจอร์ครบ" : null,
          appliances: isCondo ? ["แอร์", "ตู้เย็น", "เครื่องทำน้ำอุ่น", "เครื่องซักผ้า"] : [],
          petAllowed: r.next() < 0.25,
          attributes: attributes as Prisma.InputJsonValue,
          rentPrice: rent ? money(rent) : null,
          minRentPrice: rent ? money(Math.round((rent * 0.92) / 500) * 500) : null,
          forRent: rent !== null,
          forSale: salePrice !== null,
          salePrice: salePrice ? money(salePrice) : null,
          minSalePrice: salePrice ? money(Math.round(salePrice * 0.95)) : null,
          availableFrom: d(`2026-${String(r.int(10, 12)).padStart(2, "0")}-01`),
          status,
          primaryAgentId: agent.id,
          agents: { create: [{ userId: agent.id, role: "LISTING" }] },
        },
      });
      assets.push({ id: asset.id, category: spec.category, agentId: agent.id, ownership });

      if (ownership === OwnershipType.AGENT) {
        const formula =
          rent !== null
            ? r.pick(["ONE_MONTH", "ONE_MONTH", "N_MONTHS", "PERCENT_TOTAL"] as const)
            : "PERCENT_SALE_PRICE";
        const params = {
          ONE_MONTH: {},
          N_MONTHS: { months: 1.5 },
          PERCENT_TOTAL: { percent: 5 },
          PERCENT_SALE_PRICE: { percent: 3 },
        }[formula];
        await prisma.listingAgreement.create({
          data: {
            assetId: asset.id,
            ownerId: owner.id,
            transactionType: rent !== null ? "RENT" : "SALE",
            startDate: d("2026-06-01"),
            endDate: d(`2027-0${r.int(1, 6)}-01`),
            commissionFormula: formula,
            commissionParams: params,
          },
        });
      }
    }
  }

  // ---------- Lead 50 ราย ----------
  const statuses = Object.values(LeadStatus);
  const sources = Object.values(LeadSource);
  let sharedPhone: string | null = null;
  for (let i = 0; i < 50; i++) {
    const foreign = r.next() < 0.2;
    const intent = r.next() < 0.8 ? LeadIntent.RENT : LeadIntent.BUY;
    const owner = r.pick(agents);
    // ตั้งใจให้ lead #2 ใช้เบอร์เดียวกับ #1 (คนละรูปแบบ) เพื่อทดสอบการตรวจซ้ำ
    const phone: string | null =
      i === 1 && sharedPhone ? sharedPhone : normalizePhone(`08${r.int(10000000, 99999999)}`);
    if (i === 0) sharedPhone = phone;
    const budget = intent === LeadIntent.RENT ? r.int(8, 40) * 1000 : r.int(2, 12) * 1_000_000;
    const status = r.pick(statuses);
    const lead = await prisma.lead.create({
      data: {
        code: await nextCode(prisma, "LD", "LD-"),
        intent,
        fullName: foreign ? r.pick(FOREIGN) : `${r.pick(FIRST)} ${r.pick(LAST)}`,
        phone,
        lineId: r.next() < 0.6 ? `lead${i + 1}` : null,
        nationality: foreign ? r.pick(["อเมริกัน", "ญี่ปุ่น", "จีน", "เยอรมัน", "เกาหลี", "อินเดีย"]) : "ไทย",
        budgetMin: money(Math.round(budget * 0.7)),
        budgetMax: money(budget),
        preferredProjectId: r.next() < 0.5 ? r.pick(projects).id : null,
        preferredCategory:
          intent === LeadIntent.RENT
            ? r.pick([AssetCategory.CONDO, AssetCategory.CONDO, AssetCategory.HOUSE, AssetCategory.APARTMENT_UNIT])
            : r.pick([AssetCategory.CONDO, AssetCategory.HOUSE, AssetCategory.FACTORY, AssetCategory.LAND]),
        preferredRoomType: r.pick([RoomType.STUDIO, RoomType.ONE_BEDROOM, RoomType.TWO_BEDROOMS]),
        occupants: r.int(1, 4),
        moveInDate: d(`2026-${String(r.int(10, 12)).padStart(2, "0")}-15`),
        leaseMonths: intent === LeadIntent.RENT ? r.pick([6, 12, 12, 24]) : null,
        petRequired: r.next() < 0.15,
        source: r.pick(sources),
        ownerAgentId: owner.id,
        status,
        statusReason: status === LeadStatus.LOST ? "เลือกห้องจากที่อื่น" : null,
        lastActivityAt: new Date(Date.UTC(2026, 9, r.int(1, 18))),
        nextFollowUpAt: ([LeadStatus.LOST, LeadStatus.CANCELLED, LeadStatus.CLOSED_WON] as LeadStatus[]).includes(
          status,
        )
          ? null
          : new Date(Date.UTC(2026, 9, r.int(19, 31), 2)),
        assignments: { create: { toUserId: owner.id, assignedById: owner.id, reason: "สร้าง lead" } },
        activities: {
          create: [
            { type: "CALL", body: "โทรสอบถามความต้องการเบื้องต้น", createdById: owner.id },
            ...(r.next() < 0.5
              ? [{ type: "CHAT" as const, body: "ส่งรายการห้องทาง LINE", createdById: owner.id }]
              : []),
          ],
        },
      },
    });
    if (r.next() < 0.4) {
      const candidates = assets.filter((a) => (intent === LeadIntent.RENT ? a.category !== "LAND" : true));
      const asset = r.pick(candidates);
      await prisma.leadOffer.create({ data: { leadId: lead.id, assetId: asset.id, offeredById: owner.id } });
    }
  }

  return {
    users: await prisma.user.count(),
    owners: await prisma.owner.count(),
    assets: await prisma.asset.count(),
    leads: await prisma.lead.count(),
  };
}
