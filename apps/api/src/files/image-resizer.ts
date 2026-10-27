import sharp from "sharp";

export type ImageVariantSize = "thumb" | "medium" | "large";

export const IMAGE_VARIANTS: Record<ImageVariantSize, number> = {
  thumb: 320,
  medium: 800,
  large: 1600,
};

export async function resizeImageThreeSizes(input: Buffer): Promise<Record<ImageVariantSize, Buffer>> {
  const [thumb, medium, large] = await Promise.all(
    (Object.entries(IMAGE_VARIANTS) as Array<[ImageVariantSize, number]>).map(([, width]) =>
      sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    ),
  );
  return { thumb: thumb!, medium: medium!, large: large! };
}
