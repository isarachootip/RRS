import { type AssetCategory, type AssetStatus, type OwnershipType, Prisma, type RoomType } from "@rrs/db";

export interface ListAssetsParams {
  search?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  ownershipType?: OwnershipType;
  projectId?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "code" | "rentPrice" | "salePrice";
  sortDir?: "asc" | "desc";
}

export interface UpsertAssetInput {
  category?: AssetCategory;
  ownershipType?: OwnershipType;
  ownerId?: string | null;
  projectId?: string | null;
  buildingId?: string | null;
  tower?: string | null;
  unitNo?: string | null;
  floor?: number | null;
  address?: string | null;
  district?: string | null;
  province?: string | null;
  areaSqm?: number | null;
  roomType?: RoomType | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furniture?: string | null;
  appliances?: string[];
  petAllowed?: boolean;
  attributes?: unknown;
  listingUrls?: string[];
  rentPrice?: number | null;
  minRentPrice?: number | null;
  salePrice?: number | null;
  minSalePrice?: number | null;
  forRent?: boolean;
  forSale?: boolean;
  availableFrom?: string | null;
  status?: AssetStatus;
  primaryAgentId?: string | null;
  internalNote?: string | null;
}

export const assetDetailInclude = {
  owner: { include: { agent: { select: { teamId: true } } } },
  project: true,
  building: true,
  primaryAgent: { select: { id: true, fullName: true, teamId: true } },
  agents: { include: { user: { select: { id: true, fullName: true, teamId: true } } } },
  media: { orderBy: { sortOrder: "asc" as const }, include: { file: true } },
  agreements: { where: { archivedAt: null }, orderBy: { createdAt: "desc" as const } },
};

export const toDec = (n: number | null | undefined) =>
  n === undefined ? undefined : n === null ? null : new Prisma.Decimal(n.toFixed(2));

export function buildAssetUpdateData(
  userId: string,
  input: UpsertAssetInput,
  attributes?: Prisma.InputJsonValue,
): Prisma.AssetUncheckedUpdateInput {
  const out: Prisma.AssetUncheckedUpdateInput = { updatedById: userId };
  if (input.category !== undefined) out.category = input.category;
  if (input.ownershipType !== undefined) out.ownershipType = input.ownershipType;
  if (input.ownerId) out.ownerId = input.ownerId;
  if (input.projectId !== undefined) out.projectId = input.projectId;
  if (input.buildingId !== undefined) out.buildingId = input.buildingId;
  if (input.tower !== undefined) out.tower = input.tower;
  if (input.unitNo !== undefined) out.unitNo = input.unitNo;
  if (input.floor !== undefined) out.floor = input.floor;
  if (input.address !== undefined) out.address = input.address;
  if (input.district !== undefined) out.district = input.district;
  if (input.province !== undefined) out.province = input.province;
  if (input.areaSqm !== undefined) out.areaSqm = toDec(input.areaSqm);
  if (input.roomType !== undefined) out.roomType = input.roomType;
  if (input.bedrooms !== undefined) out.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) out.bathrooms = input.bathrooms;
  if (input.furniture !== undefined) out.furniture = input.furniture;
  if (input.appliances !== undefined) out.appliances = input.appliances;
  if (input.petAllowed !== undefined) out.petAllowed = input.petAllowed;
  if (attributes !== undefined) out.attributes = attributes;
  if (input.listingUrls !== undefined) out.listingUrls = input.listingUrls;
  if (input.rentPrice !== undefined) out.rentPrice = toDec(input.rentPrice);
  if (input.minRentPrice !== undefined) out.minRentPrice = toDec(input.minRentPrice);
  if (input.salePrice !== undefined) out.salePrice = toDec(input.salePrice);
  if (input.minSalePrice !== undefined) out.minSalePrice = toDec(input.minSalePrice);
  if (input.forRent !== undefined) out.forRent = input.forRent;
  if (input.forSale !== undefined) out.forSale = input.forSale;
  if (input.availableFrom !== undefined) out.availableFrom = input.availableFrom ? new Date(input.availableFrom) : null;
  if (input.status !== undefined) out.status = input.status;
  if (input.primaryAgentId !== undefined) out.primaryAgentId = input.primaryAgentId;
  if (input.internalNote !== undefined) out.internalNote = input.internalNote;
  return out;
}
