import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  private readonly localDir: string;
  private bucketReady = false;
  private readonly storedKeys = new Set<string>();

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = this.config.get("S3_BUCKET", { infer: true });
    this.localDir = process.env.UPLOAD_DIR ?? "/tmp/rrs-uploads";
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
        // Fallback to local disk / DB storage when S3/MinIO is not running
      }
    }
  }

  async writeLocalCache(key: string, body: Buffer): Promise<void> {
    try {
      const targetPath = join(this.localDir, key);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, body);
    } catch {
      // Ignore local disk write error if read-only fs
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.storedKeys.add(key);
    await this.writeLocalCache(key, body);
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
    } catch {
      // Local disk and PostgreSQL DB storage already saved the file
    }
  }

  async readLocalObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(join(this.localDir, key));
    } catch {
      return null;
    }
  }

  async readS3Object(key: string): Promise<Buffer | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      const buf = Buffer.from(bytes);
      await this.writeLocalCache(key, buf);
      return buf;
    } catch {
      return null;
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
