import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma, isContractLockedError, isPeriodOverlapError } from "@rrs/db";
import type { Request, Response } from "express";

/** รูปแบบ error เดียวทั้งระบบ — หน้าเว็บแสดง message ได้ตรง ๆ และใช้ code ตัดสินใจ */
export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  path: string;
}

export function toErrorBody(exception: unknown, path: string, requestId?: string): ErrorBody {
  const base = { path, requestId };

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const obj = typeof res === "object" && res !== null ? (res as Record<string, unknown>) : {};
    const message =
      typeof res === "string"
        ? res
        : Array.isArray(obj.message)
          ? obj.message.join(", ")
          : String(obj.message ?? exception.message);
    return {
      ...base,
      statusCode: status,
      code: String(obj.code ?? HttpStatus[status] ?? "ERROR"),
      message,
      details: obj.details,
    };
  }

  if (isPeriodOverlapError(exception)) {
    return { ...base, statusCode: 409, code: "PERIOD_OVERLAP", message: "ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว" };
  }
  if (isContractLockedError(exception)) {
    return {
      ...base,
      statusCode: 409,
      code: "CONTRACT_LOCKED",
      message: "สัญญานี้มีผลแล้ว แก้ไขได้ด้วยการสร้างฉบับแก้ไขใหม่เท่านั้น",
    };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === "P2002") {
      return { ...base, statusCode: 409, code: "DUPLICATE", message: "มีข้อมูลนี้อยู่แล้ว", details: exception.meta };
    }
    if (exception.code === "P2025") {
      return { ...base, statusCode: 404, code: "NOT_FOUND", message: "ไม่พบข้อมูลที่ต้องการ" };
    }
    if (exception.code === "P2003") {
      return { ...base, statusCode: 400, code: "INVALID_REFERENCE", message: "ข้อมูลที่อ้างอิงไม่มีอยู่ในระบบ" };
    }
  }
  return {
    ...base,
    statusCode: 500,
    code: "INTERNAL_ERROR",
    message: "ระบบขัดข้อง กรุณาลองใหม่หรือแจ้งผู้ดูแลระบบพร้อมรหัสคำขอ",
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const body = toErrorBody(exception, req.url, req.id ? String(req.id) : undefined);
    if (body.statusCode >= 500 && !(exception instanceof HttpException)) {
      this.logger.error({ err: exception, requestId: body.requestId }, "Unhandled error");
    }
    res.status(body.statusCode).json(body);
  }
}
