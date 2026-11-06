import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { AuditModule } from "../audit/audit.module";
import { MailModule } from "../mail/mail.module";
import { RbacModule } from "../rbac/rbac.module";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { PublicListingsController } from "./public-listings.controller";
import { PublicListingsService } from "./public-listings.service";
import { PublicPortalFormsController } from "./public-portal-forms.controller";
import { PublicPortalFormsService } from "./public-portal-forms.service";

@Module({
  imports: [RbacModule, AuditModule, AssetsModule, MailModule],
  controllers: [ListingsController, PublicListingsController, PublicPortalFormsController],
  providers: [ListingsService, PublicListingsService, PublicPortalFormsService],
  exports: [ListingsService, PublicListingsService, PublicPortalFormsService],
})
export class ListingsModule {}
