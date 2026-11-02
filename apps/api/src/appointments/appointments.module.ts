import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { RbacModule } from "../rbac/rbac.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [RbacModule, AssetsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
