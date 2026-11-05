import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

export const API_BASE = "http://localhost:4000";
export const SEED_PASS = "RrsDev#2026";
const MFA_CACHE_FILE = path.join(os.tmpdir(), "rrs-e2e-mfa-secrets.json");

function loadMfaSecrets(): Record<string, string> {
  try {
    if (fs.existsSync(MFA_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(MFA_CACHE_FILE, "utf8")) as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveMfaSecret(email: string, secret: string) {
  const data = loadMfaSecrets();
  data[email] = secret;
  fs.writeFileSync(MFA_CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function decodeBase32(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotp(secret: string): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

const cachedTokens = new Map<string, string>();

export async function apiLogin(request: APIRequestContext, email: string, password = SEED_PASS): Promise<string> {
  const existingToken = cachedTokens.get(email);
  if (existingToken) {
    const meRes = await request.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${existingToken}` },
    });
    if (meRes.ok()) {
      return existingToken;
    }
  }

  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = (await res.json()) as {
    status: string;
    accessToken?: string;
    challengeToken?: string;
  };
  if (body.status === "OK" && body.accessToken) {
    cachedTokens.set(email, body.accessToken);
    return body.accessToken;
  }
  if (body.status === "MFA_SETUP_REQUIRED" && body.challengeToken) {
    const setupRes = await request.post(`${API_BASE}/api/v1/auth/mfa/setup`, {
      data: { challengeToken: body.challengeToken },
    });
    const setupBody = (await setupRes.json()) as { secret: string };
    saveMfaSecret(email, setupBody.secret);
    const code = generateTotp(setupBody.secret);
    const enableRes = await request.post(`${API_BASE}/api/v1/auth/mfa/enable`, {
      data: { challengeToken: body.challengeToken, code },
    });
    const enableBody = (await enableRes.json()) as { accessToken: string };
    cachedTokens.set(email, enableBody.accessToken);
    return enableBody.accessToken;
  }
  if (body.status === "MFA_REQUIRED" && body.challengeToken) {
    const secrets = loadMfaSecrets();
    const secret = secrets[email];
    if (!secret) throw new Error(`Missing MFA secret in cache for ${email}`);
    const code = generateTotp(secret);
    const verifyRes = await request.post(`${API_BASE}/api/v1/auth/mfa/verify`, {
      data: { challengeToken: body.challengeToken, code },
    });
    const verifyBody = (await verifyRes.json()) as { accessToken: string };
    cachedTokens.set(email, verifyBody.accessToken);
    return verifyBody.accessToken;
  }
  throw new Error(`Unexpected login status for ${email}: ${JSON.stringify(body)}`);
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createOwnerAndTwoAssets(request: APIRequestContext, token: string, sfx: number) {
  const ownerRes = await request.post(`${API_BASE}/api/v1/owners`, {
    headers: authHeader(token),
    data: { fullName: `เจ้าของ E2E ${sfx}`, phone: `081${String(sfx).slice(-7)}` },
  });
  const owner = (await ownerRes.json()) as { id: string };

  const ownerAssetRes = await request.post(`${API_BASE}/api/v1/assets`, {
    headers: authHeader(token),
    data: {
      category: "CONDO",
      ownershipType: "OWNER",
      ownerId: owner.id,
      unitNo: `OW-${String(sfx).slice(-4)}`,
      floor: 12,
      areaSqm: 35,
      roomType: "ONE_BEDROOM",
      bedrooms: 1,
      bathrooms: 1,
      rentPrice: 28000,
      minRentPrice: 26000,
      forRent: true,
      attributes: { parkingSlots: 1, facing: "ทิศใต้" },
    },
  });
  const ownerAsset = (await ownerAssetRes.json()) as { id: string; code: string };

  const agentAssetRes = await request.post(`${API_BASE}/api/v1/assets`, {
    headers: authHeader(token),
    data: {
      category: "CONDO",
      ownershipType: "AGENT",
      ownerId: owner.id,
      unitNo: `AG-${String(sfx).slice(-4)}`,
      floor: 15,
      areaSqm: 42,
      roomType: "ONE_BEDROOM",
      bedrooms: 1,
      bathrooms: 1,
      rentPrice: 30000,
      minRentPrice: 27500,
      forRent: true,
      attributes: { parkingSlots: 1, facing: "ทิศเหนือ" },
    },
  });
  const agentAsset = (await agentAssetRes.json()) as { id: string; code: string };

  return { owner, ownerAsset, agentAsset };
}
