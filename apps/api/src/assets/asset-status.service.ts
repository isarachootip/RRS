import { Injectable } from "@nestjs/common";
import type { AssetStatus } from "@rrs/db";
import { PrismaService } from "../prisma/prisma.service";

/**
 * คำนวณสถานะทรัพย์สินอัตโนมัติ (SRS F3-8 / docs/design.md ข้อ 4)
 * ห้ามให้ผู้ใช้แก้สถานะเอง ยกเว้น UNAVAILABLE
 */
@Injectable()
export class AssetStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async recompute(assetId: string, actorUserId?: string): Promise<AssetStatus | null> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, status: true, archivedAt: true },
    });
    if (!asset || asset.archivedAt) return null;

    // หากถูกปิดชั่วคราวด้วยมือ (UNAVAILABLE) จะไม่เขียนทับอัตโนมัติ
    if (asset.status === "UNAVAILABLE") {
      return asset.status;
    }

    const nextStatus = await this.determineNextStatus(assetId);
    if (nextStatus !== asset.status) {
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: nextStatus,
          ...(actorUserId ? { updatedById: actorUserId } : {}),
        },
      });
    }
    return nextStatus;
  }

  async recomputeMany(assetIds: string[], actorUserId?: string): Promise<void> {
    const uniqueIds = Array.from(new Set(assetIds));
    for (const assetId of uniqueIds) {
      await this.recompute(assetId, actorUserId);
    }
  }

  private async determineNextStatus(assetId: string): Promise<AssetStatus> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. ขายแล้ว (โอนกรรมสิทธิ์หรือปิดการขาย)
    const soldDeal = await this.prisma.saleDeal.findFirst({
      where: { assetId, stage: { in: ["TRANSFERRED", "CLOSED"] } },
      select: { id: true },
    });
    if (soldDeal) return "SOLD";

    // 2. ทำสัญญาเช่าที่มีผลอยู่และยังไม่หมดอายุ
    const activeContract = await this.prisma.contract.findFirst({
      where: {
        assetId,
        status: "ACTIVE",
        endDate: { gte: today },
      },
      select: { id: true },
    });
    if (activeContract) return "CONTRACTED";

    // 3. จองแล้ว (ชำระเงินจองแล้ว หรือแปลงเป็นสัญญาร่าง/รอลงนาม)
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        assetId,
        OR: [
          { status: "PAID", endDate: { gte: today } },
          {
            status: "CONVERTED",
            contracts: { some: { status: { in: ["DRAFT", "PENDING_SIGNATURE"] } } },
          },
        ],
      },
      select: { id: true },
    });
    if (activeBooking) return "BOOKED";

    // 4. อยู่ระหว่างเจรจา (มีการจองรอชำระ, ดีลขายกำลังเดิน, หรือผลนัดดูห้องเป็นขอต่อรองราคา/ตกลง)
    const [pendingBooking, activeSaleDeal, negotiatingItem] = await Promise.all([
      this.prisma.booking.findFirst({
        where: { assetId, status: "PENDING_PAYMENT" },
        select: { id: true },
      }),
      this.prisma.saleDeal.findFirst({
        where: {
          assetId,
          stage: { in: ["OFFERED", "DEPOSIT_PAID", "SPA_SIGNED", "LOAN_PENDING"] },
        },
        select: { id: true },
      }),
      this.prisma.appointmentItem.findFirst({
        where: {
          assetId,
          outcome: { in: ["NEGOTIATING_PRICE", "AGREED"] },
          appointment: {
            status: "COMPLETED",
            lead: { status: { in: ["VIEWING", "NEGOTIATING", "BOOKED"] } },
          },
        },
        select: { appointmentId: true },
      }),
    ]);
    if (pendingBooking || activeSaleDeal || negotiatingItem) return "NEGOTIATING";

    // 5. มีนัดดูห้อง (มีนัดหมายสถานะ รอยืนยัน หรือ ยืนยันแล้ว)
    const scheduledViewing = await this.prisma.appointmentItem.findFirst({
      where: {
        assetId,
        appointment: { status: { in: ["PENDING", "CONFIRMED"] } },
      },
      select: { appointmentId: true },
    });
    if (scheduledViewing) return "VIEWING_SCHEDULED";

    // 6. ว่าง
    return "AVAILABLE";
  }
}
