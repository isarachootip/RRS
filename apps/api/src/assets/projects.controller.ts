import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@rrs/db";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { Can } from "../rbac/can.decorator";

const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  nameEn: z.string().trim().max(150).nullish(),
  developer: z.string().trim().max(150).nullish(),
  address: z.string().max(300).nullish(),
  district: z.string().max(100).nullish(),
  province: z.string().max(100).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  nearTransit: z.array(z.string().max(100)).max(20).optional(),
});

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Can("asset.read")
  @Get()
  @ApiOperation({ summary: "รายการโครงการทั้งหมด" })
  async list(@Query("search") search?: string) {
    const q = search?.trim();
    const items = await this.prisma.project.findMany({
      where: {
        archivedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { nameEn: { contains: q, mode: "insensitive" } },
                { district: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
    });
    return { items };
  }

  @Can("asset.write")
  @Post()
  @ApiOperation({ summary: "สร้างโครงการใหม่" })
  create(@Body(new ZodPipe(CreateProjectSchema)) body: z.infer<typeof CreateProjectSchema>) {
    return this.prisma.project.create({
      data: {
        name: body.name,
        nameEn: body.nameEn ?? null,
        developer: body.developer ?? null,
        address: body.address ?? null,
        district: body.district ?? null,
        province: body.province ?? null,
        latitude: body.latitude !== undefined && body.latitude !== null ? new Prisma.Decimal(body.latitude) : null,
        longitude: body.longitude !== undefined && body.longitude !== null ? new Prisma.Decimal(body.longitude) : null,
        nearTransit: body.nearTransit ?? [],
      },
    });
  }
}
