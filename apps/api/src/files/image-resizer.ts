import sharp from "sharp";

export type ImageVariantSize = "thumb" | "medium" | "large";

export const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1 MB (1,048,576 bytes)

export const IMAGE_VARIANTS: Record<ImageVariantSize, number> = {
  thumb: 320,
  medium: 800,
  large: 1600,
};

export interface ResizedImageResult {
  buffer: Buffer;
  mimeType: string;
}

const COMPRESSION_STEPS: ReadonlyArray<{ width: number; quality: number }> = [
  { width: 1920, quality: 82 },
  { width: 1600, quality: 76 },
  { width: 1280, quality: 70 },
  { width: 1024, quality: 62 },
  { width: 800, quality: 52 },
  { width: 640, quality: 45 },
];

/**
 * ย่อขนาดและบีบอัดรูปภาพให้มีขนาดไฟล์ไม่เกิน 1 MB (1,048,576 bytes) เสมอ
 * หากรูปเดิมเล็กกว่า 1 MB และกว้างไม่เกิน 1920px จะใช้ไฟล์เดิมทันทีโดยไม่สูญเสียคุณภาพ
 */
export async function resizeImageToMaxOneMb(input: Buffer, mimeType: string): Promise<ResizedImageResult> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (input.length <= MAX_IMAGE_SIZE_BYTES && width <= 1920 && height <= 1920) {
    return { buffer: input, mimeType };
  }

  let candidate: Buffer = input;
  const outMime = mimeType === "image/webp" ? "image/webp" : "image/jpeg";

  for (const step of COMPRESSION_STEPS) {
    const pipeline = sharp(input)
      .rotate()
      .resize({ width: step.width, height: step.width, fit: "inside", withoutEnlargement: true });

    candidate =
      outMime === "image/webp"
        ? await pipeline.webp({ quality: step.quality }).toBuffer()
        : await pipeline.jpeg({ quality: step.quality, mozjpeg: true }).toBuffer();

    if (candidate.length <= MAX_IMAGE_SIZE_BYTES) {
      return { buffer: candidate, mimeType: outMime };
    }
  }

  return { buffer: candidate, mimeType: outMime };
}

export async function resizeImageThreeSizes(input: Buffer): Promise<Record<ImageVariantSize, Buffer>> {
  const [thumb, medium, large] = await Promise.all(
    (Object.entries(IMAGE_VARIANTS) as Array<[ImageVariantSize, number]>).map(([, width]) =>
      sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    ),
  );
  return { thumb: thumb!, medium: medium!, large: large! };
}
