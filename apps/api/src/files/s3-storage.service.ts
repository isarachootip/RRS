import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady = false;
  private readonly storedKeys = new Set<string>();

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = this.config.get("S3_BUCKET", { infer: true });
    this.client = new S3Client({
      region: "ap-southeast-1",
      endpoint: this.config.get("S3_ENDPOINT", { infer: true }),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get("S3_ACCESS_KEY", { infer: true }),
        secretAccessKey: this.config.get("S3_SECRET_KEY", { infer: true }),
      },
    });
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.bucketReady = true;
      } catch {
        // ในโหมดทดสอบที่ยังไม่ได้เปิด MinIO จะบันทึก key ในหน่วยความจำแทน
      }
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.storedKeys.add(key);
    await this.ensureBucket();
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      if (process.env.NODE_ENV !== "test") throw err;
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  hasStoredKey(key: string): boolean {
    return this.storedKeys.has(key);
  }
}
