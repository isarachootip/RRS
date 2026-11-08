import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_SIZE_BYTES, resizeImageToMaxOneMb } from "../src/files/image-resizer";

describe("resizeImageToMaxOneMb (ย่อขนาดรูปภาพให้ไม่เกิน 1MB)", () => {
  it("ย่อรูปภาพขนาดใหญ่ (> 1MB) ให้เหลือขนาดไม่เกิน 1MB (1,048,576 bytes)", async () => {
    const width = 2400;
    const height = 1800;
    const rawNoise = randomBytes(width * height * 3);
    const largePng = await sharp(rawNoise, {
      raw: { width, height, channels: 3 },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    expect(largePng.length).toBeGreaterThan(MAX_IMAGE_SIZE_BYTES);

    const result = await resizeImageToMaxOneMb(largePng, "image/png");
    expect(result.buffer.length).toBeLessThanOrEqual(MAX_IMAGE_SIZE_BYTES);
    expect(result.buffer.length).toBeGreaterThan(0);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(1920);
  });

  it("คงขนาดรูปภาพเดิมไว้หากขนาดไฟล์เล็กกว่า 1MB และความกว้างไม่เกิน 1920px", async () => {
    const smallJpg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 100, b: 160 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    expect(smallJpg.length).toBeLessThan(MAX_IMAGE_SIZE_BYTES);

    const result = await resizeImageToMaxOneMb(smallJpg, "image/jpeg");
    expect(result.buffer.length).toBeLessThanOrEqual(MAX_IMAGE_SIZE_BYTES);
    expect(result.mimeType).toBe("image/jpeg");
  });
});
