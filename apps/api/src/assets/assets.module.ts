import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { AssetRelationsController } from "./asset-relations.controller";
import { AssetRelationsService } from "./asset-relations.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { BuildingsController } from "./buildings.controller";
import { BuildingsService } from "./buildings.service";
import { ProjectsController } from "./projects.controller";

@Module({
  imports: [RbacModule],
  controllers: [ProjectsController, BuildingsController, AssetsController, AssetRelationsController],
  providers: [BuildingsService, AssetsService, AssetRelationsService],
  exports: [AssetsService],
})
export class AssetsModule {}
