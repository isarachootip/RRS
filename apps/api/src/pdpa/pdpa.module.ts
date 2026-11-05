import { Module } from "@nestjs/common";
import { PdpaController } from "./pdpa.controller";
import { PdpaService } from "./pdpa.service";

@Module({
  controllers: [PdpaController],
  providers: [PdpaService],
  exports: [PdpaService],
})
export class PdpaModule {}
