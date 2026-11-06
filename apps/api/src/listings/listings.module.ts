import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { PublicListingsController } from "./public-listings.controller";
import { PublicListingsService } from "./public-listings.service";

@Module({
  imports: [RbacModule, AuditModule],
  controllers: [ListingsController, PublicListingsController],
  providers: [ListingsService, PublicListingsService],
  exports: [ListingsService, PublicListingsService],
})
export class ListingsModule {}
