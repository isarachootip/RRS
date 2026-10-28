import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";
import { SearchService } from "./search.service";

type AuthedRequest = Request & { user?: AuthUser };

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: "ค้นหาทั่วระบบ (owners, assets, leads) ด้วย pg_trgm เคารพ data scope" })
  async search(@Req() req: AuthedRequest, @Query("q") q?: string, @Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.searchService.search(req.user!, q ?? "", parsedLimit);
  }
}
