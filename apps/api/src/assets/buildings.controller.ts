import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { BuildingsService } from "./buildings.service";

const CreateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(150),
  ownerId: z.string().uuid(),
  projectId: z.string().uuid().nullish(),
  address: z.string().max(300).nullish(),
  totalFloors: z.number().int().positive().max(200).nullish(),
});

const RoomTypeEnum = z.enum([
  "STUDIO",
  "ONE_BEDROOM",
  "TWO_BEDROOMS",
  "THREE_BEDROOMS",
  "PENTHOUSE",
  "DUPLEX",
  "OTHER",
]);

const BulkUnitsSchema = z.object({
  ownershipType: z.enum(["OWNER", "AGENT"]).optional(),
  primaryAgentId: z.string().uuid().nullish(),
  units: z
    .array(
      z.object({
        unitNo: z.string().trim().min(1).max(50),
        floor: z.number().int().min(-5).max(200).nullish(),
        areaSqm: z.number().positive().nullish(),
        roomType: RoomTypeEnum.nullish(),
        bedrooms: z.number().int().nonnegative().nullish(),
        bathrooms: z.number().int().nonnegative().nullish(),
        rentPrice: z.number().nonnegative().nullish(),
        minRentPrice: z.number().nonnegative().nullish(),
        attributes: z.unknown().optional(),
      }),
    )
    .min(1)
    .max(200),
});

@ApiTags("buildings")
@ApiBearerAuth()
@Controller("buildings")
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Can("asset.read")
  @Get()
  @ApiOperation({ summary: "รายการอาคารอพาร์ตเมนต์" })
  list() {
    return this.buildings.list();
  }

  @Can("asset.write")
  @Post()
  @ApiOperation({ summary: "สร้างอาคารอพาร์ตเมนต์ (Building)" })
  create(@Body(new ZodPipe(CreateBuildingSchema)) body: z.infer<typeof CreateBuildingSchema>) {
    return this.buildings.create(body);
  }

  @Can("asset.write")
  @Post(":id/bulk-units")
  @ApiOperation({ summary: "เพิ่มห้องอพาร์ตเมนต์ทีละหลายห้อง (Bulk Units)" })
  bulkUnits(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(BulkUnitsSchema)) body: z.infer<typeof BulkUnitsSchema>,
  ) {
    return this.buildings.bulkCreateUnits(user, id, body);
  }
}
