import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { SaleDealsService } from "./sale-deals.service";
import {
  type CreateSaleDealDto,
  createSaleDealSchema,
  type ListSaleDealsQueryDto,
  listSaleDealsQuerySchema,
  type UpdateSaleDealDto,
  updateSaleDealSchema,
} from "./sale-deals.types";

@ApiTags("sale-deals")
@ApiBearerAuth()
@Controller("sale-deals")
export class SaleDealsController {
  constructor(private readonly service: SaleDealsService) {}

  @Can("sale.read")
  @Get()
  @ApiOperation({ summary: "ดึงรายการดีลขายตามสถานะและสิทธิ์" })
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listSaleDealsQuerySchema)) query: ListSaleDealsQueryDto) {
    return this.service.list(user, query);
  }

  @Can("sale.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดดีลขายรายรายการ" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getById(user, id);
  }

  @Can("sale.write")
  @Post()
  @ApiOperation({ summary: "สร้างดีลขายใหม่ (SD-000001)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createSaleDealSchema)) body: CreateSaleDealDto) {
    return this.service.create(user, body);
  }

  @Can("sale.write")
  @Patch(":id")
  @ApiOperation({
    summary: "อัปเดตสถานะ Pipeline งานขาย ราคาตกลง วันโอน ค่าธรรมเนียมโอน และสร้าง Commission เมื่อปิดการขาย",
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateSaleDealSchema)) body: UpdateSaleDealDto,
  ) {
    return this.service.update(user, id, body);
  }
}
