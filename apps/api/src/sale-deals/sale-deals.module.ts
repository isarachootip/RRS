import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { RbacModule } from "../rbac/rbac.module";
import { SaleDealsController } from "./sale-deals.controller";
import { SaleDealsService } from "./sale-deals.service";

@Module({
  imports: [RbacModule, AssetsModule],
  controllers: [SaleDealsController],
  providers: [SaleDealsService],
  exports: [SaleDealsService],
})
export class SaleDealsModule {}
