import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { type UpdateAppointmentStatusInput, appointmentInclude } from "./appointments.types";

export async function completeAppointmentWithFollowUp(
  prisma: PrismaService,
  userId: string,
  existing: { id: string; leadId: string; items: Array<{ assetId: string }> },
  input: UpdateAppointmentStatusInput,
) {
  const outcomeMap = new Map((input.outcomes ?? []).map((o) => [o.assetId, o]));
  const missingOutcome = existing.items.some((i) => !outcomeMap.has(i.assetId));
  const nextFollowUp = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;

  if (missingOutcome || !nextFollowUp || Number.isNaN(nextFollowUp.getTime())) {
    throw new BadRequestException({
      code: "FOLLOW_UP_REQUIRED",
      message: "เมื่อนัดสำเร็จ ต้องบันทึกผลการติดตามครบทุกห้องและระบุวันติดตามครั้งถัดไป",
    });
  }

  const hasNegotiating = (input.outcomes ?? []).some(
    (o) => o.outcome === "NEGOTIATING_PRICE" || o.outcome === "AGREED",
  );

  return prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      const entry = outcomeMap.get(item.assetId)!;
      await tx.appointmentItem.update({
        where: { appointmentId_assetId: { appointmentId: existing.id, assetId: item.assetId } },
        data: { outcome: entry.outcome, outcomeNote: entry.outcomeNote ?? null },
      });
    }

    await tx.activity.create({
      data: {
        type: "FOLLOW_UP",
        leadId: existing.leadId,
        appointmentId: existing.id,
        body: input.note ?? "บันทึกผลติดตามหลังนัดดูห้อง",
        outcome: input.outcomes?.[0]?.outcome ?? null,
        nextFollowUpAt: nextFollowUp,
        createdById: userId,
      },
    });

    await tx.lead.update({
      where: { id: existing.leadId },
      data: {
        nextFollowUpAt: nextFollowUp,
        lastActivityAt: new Date(),
        ...(hasNegotiating ? { status: "NEGOTIATING" } : {}),
        updatedById: userId,
      },
    });

    return tx.appointment.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedById: userId,
      },
      include: appointmentInclude,
    });
  });
}
