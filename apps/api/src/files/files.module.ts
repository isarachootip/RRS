import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";
import { S3StorageService } from "./s3-storage.service";

@Module({
  controllers: [FilesController],
  providers: [S3StorageService, FilesService],
  exports: [S3StorageService, FilesService],
})
export class FilesModule {}
