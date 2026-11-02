import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { MatchingService } from "./matching.service";
import {
  createLeadOffersSchema,
  matchQuerySchema,
  type CreateLeadOffersInput,
  type MatchQueryInput,
} from "./matching.types";

type AuthedRequest = Request & { user?: AuthUser };

@ApiTags("matching")
@Controller()
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get("leads/:leadId/matches")
  @Can("lead.read")
  @ApiOperation({ summary: "จับคู่ห้องว่างจากเงื่อนไขของลูกค้า เรียงตามคะแนนความตรง" })
  async findMatches(
    @Req() req: AuthedRequest,
    @Param("leadId") leadId: string,
    @Query(new ZodPipe(matchQuerySchema)) query: MatchQueryInput,
  ) {
    return this.matchingService.findMatchesForLead(req.user!, leadId, query);
  }

  @Get("leads/:leadId/offers")
  @Can("lead.read")
  @ApiOperation({ summary: "ดูรายการห้องที่เคยเสนอให้ลูกค้ารายนี้" })
  async listOffers(@Req() req: AuthedRequest, @Param("leadId") leadId: string) {
    return this.matchingService.listOffersForLead(req.user!, leadId);
  }

  @Post("leads/:leadId/offers")
  @Can("lead.write")
  @ApiOperation({ summary: "บันทึกห้องที่เสนอให้ลูกค้าและสร้างลิงก์แชร์อายุ 7 วัน" })
  async createOffers(
    @Req() req: AuthedRequest,
    @Param("leadId") leadId: string,
    @Body(new ZodPipe(createLeadOffersSchema)) body: CreateLeadOffersInput,
  ) {
    return this.matchingService.createOffersForLead(req.user!, leadId, body);
  }

  @Public()
  @Get("public/offers/:token")
  @ApiOperation({ summary: "หน้าแสดงห้องที่เสนอสำหรับลูกค้า (ไม่มี minPrice/เลขห้อง/เจ้าของ)" })
  async getPublicOffers(@Param("token") token: string) {
    return this.matchingService.getPublicOffersByToken(token);
  }
}
