/** เรียก API หลังบ้าน — ใช้ Same-Origin (/api/v1/*) ผ่าน Next.js Rewrite Proxy เป็นค่าเริ่มต้น */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

// access token อยู่ในหน่วยความจำเท่านั้น (ไม่เก็บใน localStorage กัน XSS ขโมย)
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

async function raw<T>(path: string, init?: RequestInit, withToken = true): Promise<T> {
  let res: Response;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(isFormData ? {} : { "content-type": "application/json" }),
        ...(withToken && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      String(body?.code ?? "ERROR"),
      String(body?.message ?? res.statusText),
      body?.requestId as string | undefined,
      body?.details,
    );
  }
  return body as T;
}

export interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  user: Me;
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  teamId: string | null;
  roles: string[];
  permissions: Record<string, "ALL" | "TEAM" | "OWN">;
  totpEnabled: boolean;
  mfaRequired: boolean;
}

let refreshing: Promise<SessionPayload | null> | null = null;

/** ขอ access token ใหม่จาก refresh cookie — เรียกพร้อมกันหลายที่ก็ยิงจริงครั้งเดียว */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshing ??= raw<SessionPayload>("/api/v1/auth/refresh", { method: "POST" }, false)
    .then((s) => {
      setAccessToken(s.accessToken);
      return s;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** เรียก API พร้อม token; ถ้า token หมดอายุจะ refresh ให้อัตโนมัติ 1 ครั้ง */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && e.statusCode === 401 && e.code === "UNAUTHENTICATED" && (await refreshSession())) {
      return raw<T>(path, init);
    }
    throw e;
  }
}

/** เรียก endpoint ที่ไม่ต้องล็อกอิน */
export const publicApi = <T>(path: string, body: unknown) =>
  raw<T>(path, { method: "POST", body: JSON.stringify(body) }, false);

export interface UploadedFileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string | null;
  entityId: string | null;
}

export const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024; // 1 MB

/** ย่อรูปภาพฝั่งเบราว์เซอร์ให้ขนาดไม่เกิน 1 MB ก่อนอัปโหลด */
export async function resizeImageFileUnderOneMb(file: File): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.size <= MAX_IMAGE_UPLOAD_BYTES ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const outType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const steps = [
      { maxDim: 1920, quality: 0.82 },
      { maxDim: 1600, quality: 0.74 },
      { maxDim: 1280, quality: 0.66 },
      { maxDim: 1024, quality: 0.56 },
    ];
    let lastBlob: Blob | null = null;
    for (const step of steps) {
      const ratio = Math.min(1, step.maxDim / Math.max(bitmap.width, bitmap.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, step.quality));
      if (!blob) continue;
      lastBlob = blob;
      if (blob.size <= MAX_IMAGE_UPLOAD_BYTES) break;
    }
    bitmap.close?.();
    if (!lastBlob) return file;
    const ext = outType === "image/webp" ? "webp" : "jpg";
    const nextName = file.name.replace(/\.[^.]+$/, `.${ext}`);
    return new File([lastBlob], nextName, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** อัปโหลดไฟล์สแกนเอกสารหรือรูปภาพไปยัง /api/v1/files (ย่อรูปไม่เกิน 1 MB อัตโนมัติ) */
export async function uploadEntityFile(
  file: File,
  entityType?: string,
  entityId?: string,
): Promise<UploadedFileRecord> {
  const readyFile = await resizeImageFileUnderOneMb(file);
  const fd = new FormData();
  fd.append("file", readyFile);
  if (entityType) fd.append("entityType", entityType);
  if (entityId) fd.append("entityId", entityId);
  return api<UploadedFileRecord>("/api/v1/files", { method: "POST", body: fd });
}
