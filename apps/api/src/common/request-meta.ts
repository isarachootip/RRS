import type { Request } from "express";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip,
  userAgent: req.get("user-agent")?.slice(0, 300),
});
