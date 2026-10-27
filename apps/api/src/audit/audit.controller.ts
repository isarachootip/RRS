import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { AuditService } from "./audit.service";

const AuditQuery = z.object({
  entityType: z.string().trim().min(1).max(60),
  entityId: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "ดึงประวัติการแก้ไข (Audit Log) ของแต่ละ entity สำหรับแสดงใน <Timeline />" })
  list(@Query(new ZodPipe(AuditQuery)) query: z.infer<typeof AuditQuery>) {
    return this.audit.listByEntity(query.entityType, query.entityId, query.limit ?? 50);
  }
}
