import { ASSET_CATEGORIES } from "@rrs/shared";
import { z } from "zod";

export const createListingSchema = z.object({
  assetId: z.string().uuid(),
  type: z.enum(["RENT", "SALE"]),
  price: z.coerce.number().positive("ราคาประกาศต้องมากกว่า 0"),
  titleTh: z.string().trim().min(3, "กรุณาระบุหัวข้อภาษาไทยอย่างน้อย 3 ตัวอักษร").max(200),
  titleEn: z.string().trim().max(200).nullable().optional(),
  descriptionTh: z.string().trim().max(5000).nullable().optional(),
  descriptionEn: z.string().trim().max(5000).nullable().optional(),
  slug: z.string().trim().max(180).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  submitForApproval: z.boolean().optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = z.object({
  price: z.coerce.number().positive("ราคาประกาศต้องมากกว่า 0").optional(),
  titleTh: z.string().trim().min(3).max(200).optional(),
  titleEn: z.string().trim().max(200).nullable().optional(),
  descriptionTh: z.string().trim().max(5000).nullable().optional(),
  descriptionEn: z.string().trim().max(5000).nullable().optional(),
  slug: z.string().trim().max(180).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

export const listBackofficeListingsSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "CLOSED"]).optional(),
  type: z.enum(["RENT", "SALE"]).optional(),
  assetId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListBackofficeListingsQuery = z.infer<typeof listBackofficeListingsSchema>;

export const listPublicListingsSchema = z.object({
  type: z.enum(["RENT", "SALE"]).optional(),
  category: z.enum(ASSET_CATEGORIES).optional(),
  q: z.string().optional(),
  district: z.string().optional(),
  projectId: z.string().uuid().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minAreaSqm: z.coerce.number().min(0).optional(),
  maxAreaSqm: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  roomType: z
    .enum(["STUDIO", "ONE_BEDROOM", "TWO_BEDROOMS", "THREE_BEDROOMS", "PENTHOUSE", "DUPLEX", "OTHER"])
    .optional(),
  petAllowed: z.enum(["true", "false"]).optional(),
  nearTransit: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export type ListPublicListingsQuery = z.infer<typeof listPublicListingsSchema>;

export interface PublicListingLocationDto {
  latitude: number | null;
  longitude: number | null;
  approximateLocation: boolean;
}

export interface PublicListingCardDto {
  id: string;
  slug: string;
  type: "RENT" | "SALE";
  price: number;
  titleTh: string;
  titleEn: string | null;
  descriptionTh: string | null;
  descriptionEn: string | null;
  publishedAt: string | null;
  viewCount: number;
  asset: {
    code: string;
    category: string;
    tower: string | null;
    floor: number | null;
    district: string | null;
    province: string | null;
    areaSqm: number | null;
    roomType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    furniture: string | null;
    appliances: string[];
    petAllowed: boolean;
    attributes: Record<string, unknown>;
    location: PublicListingLocationDto;
    project: {
      id: string;
      name: string;
      nameEn: string | null;
      district: string | null;
      province: string | null;
      nearTransit: string[];
    } | null;
    media: Array<{
      id: string;
      fileId: string;
      url: string;
      caption: string | null;
      isCover: boolean;
      sortOrder: number;
    }>;
    agent: {
      id: string;
      fullName: string;
    } | null;
  };
}
