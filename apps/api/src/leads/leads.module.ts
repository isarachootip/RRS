import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { LeadOwnershipController } from "./lead-ownership.controller";
import { LeadOwnershipService } from "./lead-ownership.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

@Module({
  imports: [RbacModule],
  controllers: [LeadsController, LeadOwnershipController],
  providers: [LeadsService, LeadOwnershipService],
  exports: [LeadsService, LeadOwnershipService],
})
export class LeadsModule {}
