import { Controller, Get, Header, HttpException, HttpStatus, Param, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { type ListPublicListingsQuery, listPublicListingsSchema } from "./listings.types";
import { PublicListingsService } from "./public-listings.service";

const PUBLIC_WINDOW_MS = 60_000;
const PUBLIC_MAX_REQ_PER_WINDOW = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function enforcePublicRateLimit(key: string, maxRequests = PUBLIC_MAX_REQ_PER_WINDOW): void {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + PUBLIC_WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > maxRequests) {
    throw new HttpException(
      { code: "RATE_LIMIT_EXCEEDED", message: "คำขอเกินจำนวนที่กำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง" },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export function resetPublicRateLimitBuckets(): void {
  rateBuckets.clear();
}

@ApiTags("public-listings")
@Public()
@Controller("public/listings")
export class PublicListingsController {
  constructor(private readonly publicListings: PublicListingsService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  @ApiOperation({ summary: "ค้นหาและกรองประกาศสาธารณะ (Read-only DTO Whitelist)" })
  list(@Req() req: Request, @Query(new ZodPipe(listPublicListingsSchema)) query: ListPublicListingsQuery) {
    const { ip } = requestMeta(req);
    const customMax = req.headers["x-rate-limit-max"] ? Number(req.headers["x-rate-limit-max"]) : undefined;
    enforcePublicRateLimit(`public-list:${ip ?? "unknown"}`, customMax);
    return this.publicListings.listPublic(query);
  }

  @Get("contact-config")
  @ApiOperation({ summary: "ดึงการตั้งค่าช่องทางติดต่อหลักหน้าเว็บ Portal (LINE OA องค์กร & เบอร์โทร)" })
  getContactConfig() {
    return this.publicListings.getContactConfig();
  }

  @Get(":slug")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  @ApiOperation({ summary: "ดูรายละเอียดประกาศสาธารณะตาม slug พร้อมประกาศใกล้เคียง" })
  getBySlug(@Req() req: Request, @Param("slug") slug: string) {
    const { ip } = requestMeta(req);
    const customMax = req.headers["x-rate-limit-max"] ? Number(req.headers["x-rate-limit-max"]) : undefined;
    enforcePublicRateLimit(`public-slug:${ip ?? "unknown"}`, customMax);
    return this.publicListings.getPublicBySlug(slug);
  }
}
