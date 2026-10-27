import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { FilesService, MAX_FILE_SIZE_BYTES } from "./files.service";

interface UploadedMultipartFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const UploadBody = z.object({
  entityType: z.string().trim().min(1).max(60).optional(),
  entityId: z.string().uuid().optional(),
});

const ListFilesQuery = z.object({
  entityType: z.string().trim().min(1).max(60),
  entityId: z.string().uuid(),
});

@ApiTags("files")
@ApiBearerAuth()
@Controller("files")
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "อัปโหลดไฟล์ไปยัง S3/MinIO (จำกัด jpg/png/webp/pdf ไม่เกิน 15MB และย่อรูป 3 ขนาด)",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body(new ZodPipe(UploadBody)) body: z.infer<typeof UploadBody>,
  ) {
    if (!file) {
      throw new BadRequestException({ code: "FILE_REQUIRED", message: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" });
    }
    return this.files.upload({
      actorId: user.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
    });
  }

  @Get()
  @ApiOperation({ summary: "รายการไฟล์ที่ผูกกับ entity" })
  list(@Query(new ZodPipe(ListFilesQuery)) query: z.infer<typeof ListFilesQuery>) {
    return this.files.listByEntity(query.entityType, query.entityId);
  }

  @Get(":id/url")
  @ApiOperation({ summary: "ขอ signed URL สำหรับดาวน์โหลด/เปิดดูไฟล์ (หมดอายุใน 5 นาที)" })
  getSignedUrl(@Param("id") id: string) {
    return this.files.getSignedUrls(id);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @ApiOperation({ summary: "เก็บไฟล์เข้ากรุ (Archive)" })
  archive(@Param("id") id: string) {
    return this.files.archive(id);
  }
}
