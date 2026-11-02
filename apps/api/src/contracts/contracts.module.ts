import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { RbacModule } from "../rbac/rbac.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [RbacModule, AssetsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
