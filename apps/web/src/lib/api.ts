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

/** อัปโหลดไฟล์สแกนเอกสารหรือรูปภาพไปยัง /api/v1/files */
export async function uploadEntityFile(
  file: File,
  entityType?: string,
  entityId?: string,
): Promise<UploadedFileRecord> {
  const fd = new FormData();
  fd.append("file", file);
  if (entityType) fd.append("entityType", entityType);
  if (entityId) fd.append("entityId", entityId);
  return api<UploadedFileRecord>("/api/v1/files", { method: "POST", body: fd });
}
