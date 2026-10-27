import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";

@Module({
  imports: [RbacModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
