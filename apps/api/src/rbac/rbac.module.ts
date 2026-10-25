import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { DataScopeService } from "./data-scope.service";
import { PermissionCacheService } from "./permission-cache.service";
import { PermissionGuard } from "./permission.guard";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { ScopedEntitiesController } from "./scoped-entities.controller";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule],
  controllers: [UsersController, TeamsController, RolesController, ScopedEntitiesController],
  providers: [
    PermissionCacheService,
    DataScopeService,
    UsersService,
    TeamsService,
    RolesService,
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PermissionCacheService, DataScopeService],
})
export class RbacModule {}
