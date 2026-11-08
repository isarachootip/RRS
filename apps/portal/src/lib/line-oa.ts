"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "./public-api";

export interface PortalContactConfig {
  lineOaId: string;
  phone: string;
  companyName: string;
}

export const DEFAULT_PORTAL_CONTACT: PortalContactConfig = {
  lineOaId: process.env.NEXT_PUBLIC_LINE_OA_ID ?? "@rrs",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "02-000-0000",
  companyName: "RRS Real Estate",
};

export function normalizeLineOaId(raw?: string | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "@rrs";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function buildLineOaPropertyMessage(params: {
  assetCode: string;
  title?: string;
  price?: number;
  type?: "RENT" | "SALE";
  locale?: string;
}): string {
  const code = params.assetCode.trim() || "PR";
  const isTh = (params.locale ?? "th") === "th";
  const txLabel =
    params.type === "SALE"
      ? isTh
        ? "ซื้อ"
        : "Buy"
      : isTh
        ? "เช่า"
        : "Rent";
  const priceText =
    params.price && params.price > 0
      ? isTh
        ? ` ราคา ฿${params.price.toLocaleString()}`
        : ` (฿${params.price.toLocaleString()})`
      : "";
  const titleText = params.title?.trim() ? ` — ${params.title.trim()}` : "";

  if (isTh) {
    return `สวัสดีครับ/ค่ะ สนใจ${txLabel}ทรัพย์สินรหัส ${code}${titleText}${priceText} ขอสอบถามข้อมูลเพิ่มเติม/นัดชมทรัพย์ครับ`;
  }
  return `Hello, I'm interested in ${txLabel.toLowerCase()}ing property ${code}${titleText}${priceText}. Please send more details.`;
}

/**
 * สร้างลิงก์ LINE OA (oaMessage) ที่เปิดห้องแชทพร้อมพิมพ์รหัสทรัพย์สินและชื่อประกาศให้อัตโนมัติ
 */
export function buildLineOaPropertyUrl(params: {
  lineOaId?: string | null;
  assetCode: string;
  title?: string;
  price?: number;
  type?: "RENT" | "SALE";
  locale?: string;
}): string {
  const oaId = normalizeLineOaId(params.lineOaId);
  const message = buildLineOaPropertyMessage(params);
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`;
}

/**
 * สร้างลิงก์แอดเพื่อน/ทักแชท LINE OA ทั่วไปสำหรับปุ่มบนหัวเว็บและปุ่มลอย
 */
export function buildLineOaGeneralUrl(lineOaId?: string | null, locale = "th"): string {
  const oaId = normalizeLineOaId(lineOaId);
  const msg =
    locale === "th"
      ? "สวัสดีครับ/ค่ะ สนใจสอบถามบริการเช่า/ซื้ออสังหาริมทรัพย์ครับ"
      : "Hello, I would like to inquire about properties for rent/sale.";
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(msg)}`;
}

let cachedConfig: PortalContactConfig | null = null;
let inflightConfig: Promise<PortalContactConfig> | null = null;

export async function fetchPortalContactConfig(): Promise<PortalContactConfig> {
  if (cachedConfig) return cachedConfig;
  inflightConfig ??= fetch(`${getApiBaseUrl()}/public/listings/contact-config`)
    .then(async (res) => {
      if (!res.ok) return DEFAULT_PORTAL_CONTACT;
      const data = (await res.json()) as Partial<PortalContactConfig>;
      cachedConfig = {
        lineOaId: normalizeLineOaId(data.lineOaId ?? DEFAULT_PORTAL_CONTACT.lineOaId),
        phone: (data.phone ?? DEFAULT_PORTAL_CONTACT.phone).trim() || DEFAULT_PORTAL_CONTACT.phone,
        companyName: (data.companyName ?? DEFAULT_PORTAL_CONTACT.companyName).trim() || DEFAULT_PORTAL_CONTACT.companyName,
      };
      return cachedConfig;
    })
    .catch(() => DEFAULT_PORTAL_CONTACT)
    .finally(() => {
      inflightConfig = null;
    });
  return inflightConfig;
}

export function usePortalContactConfig(): PortalContactConfig {
  const [config, setConfig] = useState<PortalContactConfig>(cachedConfig ?? DEFAULT_PORTAL_CONTACT);
  useEffect(() => {
    void fetchPortalContactConfig().then(setConfig);
  }, []);
  return config;
}
