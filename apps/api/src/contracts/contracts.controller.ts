import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { ContractsService } from "./contracts.service";
import {
  type CreateContractDto,
  createContractSchema,
  type ExpireContractsJobDto,
  expireContractsJobSchema,
  type ListContractsQueryDto,
  listContractsQuerySchema,
  type RenewContractDto,
  type ReviseContractDto,
  renewContractSchema,
  reviseContractSchema,
  type SignContractDto,
  signContractSchema,
  type TerminateContractDto,
  terminateContractSchema,
} from "./contracts.types";

@ApiTags("contracts")
@ApiBearerAuth()
@Controller("contracts")
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Can("contract.read")
  @Get()
  @ApiOperation({ summary: "ดึงรายการสัญญาเช่าตามตัวกรองและขอบเขตข้อมูล" })
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listContractsQuerySchema)) query: ListContractsQueryDto) {
    return this.service.list(user, query);
  }

  @Can("contract.read")
  @Get("history/asset/:assetId")
  @ApiOperation({ summary: "ประวัติสัญญาเช่าของทรัพย์สินเรียงตามเวลา" })
  historyByAsset(@CurrentUser() user: AuthUser, @Param("assetId") assetId: string) {
    return this.service.historyByAsset(user, assetId);
  }

  @Can("contract.read")
  @Get("history/lead/:leadId")
  @ApiOperation({ summary: "ประวัติสัญญาเช่าของลูกค้าเรียงตามเวลา" })
  historyByLead(@CurrentUser() user: AuthUser, @Param("leadId") leadId: string) {
    return this.service.historyByLead(user, leadId);
  }

  @Can("contract.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดสัญญาเช่ารายรายการ" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getById(user, id);
  }

  @Can("contract.write")
  @Post()
  @ApiOperation({ summary: "สร้างสัญญาเช่า (แปลงจากการจอง หรือสร้างใหม่ พร้อมเลขที่ LS-YYYY-0001)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createContractSchema)) body: CreateContractDto) {
    return this.service.create(user, body);
  }

  @Can("contract.write")
  @Post(":id/sign")
  @HttpCode(200)
  @ApiOperation({
    summary: "ลงนามสัญญาเช่า (เปลี่ยนสถานะเป็น ACTIVE, ห้องเป็น CONTRACTED และสร้าง Commission รอคำนวณ)",
  })
  sign(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(signContractSchema)) body: SignContractDto,
  ) {
    return this.service.sign(user, id, body);
  }

  @Can("contract.write")
  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขสัญญาเช่า (ถ้ามีผลแล้วจะสร้าง revision ใหม่และเปลี่ยนแถวเดิมเป็น SUPERSEDED)" })
  revise(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(reviseContractSchema)) body: ReviseContractDto,
  ) {
    return this.service.revise(user, id, body);
  }

  @Can("contract.write")
  @Post(":id/renew")
  @ApiOperation({ summary: "ต่อสัญญาเช่า (สร้างสัญญาใหม่ที่ชี้ previousContractId มายังสัญญาเดิม)" })
  renew(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(renewContractSchema)) body: RenewContractDto,
  ) {
    return this.service.renew(user, id, body);
  }

  @Can("contract.write")
  @Post(":id/terminate")
  @HttpCode(200)
  @ApiOperation({ summary: "ยกเลิกสัญญาก่อนกำหนด (บันทึกวันที่และเหตุผล พร้อมคืนสถานะห้องเป็นว่าง)" })
  terminate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(terminateContractSchema)) body: TerminateContractDto,
  ) {
    return this.service.terminate(user, id, body);
  }

  @Can("contract.write")
  @Post("jobs/expire")
  @HttpCode(200)
  @ApiOperation({ summary: "Job รายวันตรวจสอบสัญญาที่เลยวันสิ้นสุดแล้วให้เป็น ENDED และคืนสถานะห้องเป็นว่าง" })
  expireEnded(@Body(new ZodPipe(expireContractsJobSchema)) body: ExpireContractsJobDto) {
    return this.service.expireEndedContracts(body.asOfDate);
  }
}
