import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ASSET_CATEGORIES } from "@rrs/shared";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { AssetsService } from "./assets.service";

const CategoryEnum = z.enum(ASSET_CATEGORIES);
const OwnershipTypeEnum = z.enum(["OWNER", "AGENT"]);
const AssetStatusEnum = z.enum([
  "AVAILABLE",
  "VIEWING_SCHEDULED",
  "NEGOTIATING",
  "BOOKED",
  "CONTRACTED",
  "SOLD",
  "UNAVAILABLE",
]);
const RoomTypeEnum = z.enum([
  "STUDIO",
  "ONE_BEDROOM",
  "TWO_BEDROOMS",
  "THREE_BEDROOMS",
  "PENTHOUSE",
  "DUPLEX",
  "OTHER",
]);

const ListAssetsQuerySchema = z.object({
  search: z.string().optional(),
  category: CategoryEnum.optional(),
  status: AssetStatusEnum.optional(),
  ownershipType: OwnershipTypeEnum.optional(),
  projectId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["createdAt", "code", "rentPrice", "salePrice"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const CreateAssetSchema = z.object({
  category: CategoryEnum,
  ownershipType: OwnershipTypeEnum,
  ownerId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
  buildingId: z.string().uuid().nullish(),
  tower: z.string().max(100).nullish(),
  unitNo: z.string().max(80).nullish(),
  floor: z.number().int().min(-10).max(250).nullish(),
  address: z.string().max(300).nullish(),
  district: z.string().max(100).nullish(),
  province: z.string().max(100).nullish(),
  areaSqm: z.number().positive().nullish(),
  roomType: RoomTypeEnum.nullish(),
  bedrooms: z.number().int().nonnegative().nullish(),
  bathrooms: z.number().int().nonnegative().nullish(),
  furniture: z.string().max(300).nullish(),
  appliances: z.array(z.string().max(100)).max(50).optional(),
  petAllowed: z.boolean().optional(),
  attributes: z.unknown().optional(),
  listingUrls: z.array(z.string().max(500)).max(20).optional(),
  rentPrice: z.number().nonnegative().nullish(),
  minRentPrice: z.number().nonnegative().nullish(),
  salePrice: z.number().nonnegative().nullish(),
  minSalePrice: z.number().nonnegative().nullish(),
  forRent: z.boolean().optional(),
  forSale: z.boolean().optional(),
  availableFrom: z.string().nullish(),
  status: AssetStatusEnum.optional(),
  primaryAgentId: z.string().uuid().nullish(),
  internalNote: z.string().max(2000).nullish(),
});

const UpdateAssetSchema = CreateAssetSchema.partial();

@ApiTags("assets")
@ApiBearerAuth()
@Controller("assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Can("asset.read")
  @Get()
  @ApiOperation({ summary: "รายการทรัพย์สินพร้อมค้นหา กรอง เรียง แบ่งหน้า และซ่อน minPrice/ข้อมูลติดต่อตามสิทธิ์" })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListAssetsQuerySchema)) query: z.infer<typeof ListAssetsQuerySchema>,
  ) {
    return this.assets.list(user, query);
  }

  @Can("asset.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดทรัพย์สินพร้อมรูป ผู้ดูแล และสัญญาฝาก" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.assets.getById(user, id);
  }

  @Can("asset.write")
  @Post()
  @ApiOperation({ summary: "สร้างทรัพย์สินใหม่ (ตรวจ attributes ตาม asset_category)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateAssetSchema)) body: z.infer<typeof CreateAssetSchema>) {
    return this.assets.create(user, body);
  }

  @Can("asset.write")
  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขข้อมูลทรัพย์สิน (สถานะแก้มือได้เฉพาะ UNAVAILABLE/AVAILABLE)" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateAssetSchema)) body: z.infer<typeof UpdateAssetSchema>,
  ) {
    return this.assets.update(user, id, body);
  }

  @Can("asset.write")
  @Post(":id/archive")
  @HttpCode(200)
  @ApiOperation({ summary: "เก็บทรัพย์สินเข้ากรุ (Archive)" })
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.assets.archive(user, id);
  }
}
