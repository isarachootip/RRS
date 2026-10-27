import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { type ImageVariantSize, resizeImageThreeSizes } from "./image-resizer";
import { S3StorageService } from "./s3-storage.service";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_MIMES = new Set([...ALLOWED_IMAGE_MIMES, "application/pdf"]);

function hasValidMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  // ปฏิเสธไฟล์ executable เสมอ (MZ header)
  if (buf[0] === 0x4d && buf[1] === 0x5a) return false;
  if (mimeType === "application/pdf") {
    return buf.subarray(0, 4).toString("ascii") === "%PDF";
  }
  if (mimeType === "image/png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return buf.subarray(0, 4).toString("ascii") === "RIFF";
  }
  return false;
}

export interface UploadFileParams {
  actorId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  entityType?: string | null;
  entityId?: string | null;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  async upload(params: UploadFileParams) {
    const ext = params.originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_MIMES.has(params.mimeType) || ext === "exe" || !hasValidMagicBytes(params.buffer, params.mimeType)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP) และ PDF เท่านั้น",
      });
    }
    if (params.sizeBytes > MAX_FILE_SIZE_BYTES || params.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "ขนาดไฟล์ต้องไม่เกิน 15MB",
      });
    }

    const safeName = params.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const folder = params.entityType ? params.entityType.replace(/[^a-z0-9_]/gi, "") : "general";
    const storageKey = `${folder}/${randomUUID()}-${safeName}`;

    await this.s3.putObject(storageKey, params.buffer, params.mimeType);

    let variants: ImageVariantSize[] = [];
    if (ALLOWED_IMAGE_MIMES.has(params.mimeType)) {
      const resized = await resizeImageThreeSizes(params.buffer);
      variants = ["thumb", "medium", "large"];
      await Promise.all(
        variants.map((size) => this.s3.putObject(`${storageKey}.${size}.webp`, resized[size], "image/webp")),
      );
    }

    const row = await this.prisma.file.create({
      data: {
        storageKey,
        originalName: params.originalName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        uploadedById: params.actorId,
      },
    });

    return {
      ...row,
      variants,
    };
  }

  async listByEntity(entityType: string, entityId: string) {
    const items = await this.prisma.file.findMany({
      where: { entityType, entityId, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  }

  async getSignedUrls(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.archivedAt) {
      throw new NotFoundException({ code: "FILE_NOT_FOUND", message: "ไม่พบไฟล์นี้" });
    }

    const url = await this.s3.getSignedDownloadUrl(file.storageKey, SIGNED_URL_TTL_SECONDS);
    const isImage = ALLOWED_IMAGE_MIMES.has(file.mimeType);

    const variants = isImage
      ? {
          thumb: await this.s3.getSignedDownloadUrl(`${file.storageKey}.thumb.webp`, SIGNED_URL_TTL_SECONDS),
          medium: await this.s3.getSignedDownloadUrl(`${file.storageKey}.medium.webp`, SIGNED_URL_TTL_SECONDS),
          large: await this.s3.getSignedDownloadUrl(`${file.storageKey}.large.webp`, SIGNED_URL_TTL_SECONDS),
        }
      : null;

    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      url,
      variants,
    };
  }

  async archive(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.archivedAt) {
      throw new NotFoundException({ code: "FILE_NOT_FOUND", message: "ไม่พบไฟล์นี้" });
    }
    return this.prisma.file.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
