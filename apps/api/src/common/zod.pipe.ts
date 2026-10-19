import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** ตรวจ body ด้วย zod — ข้อผิดพลาดตอบเป็น 400 VALIDATION_ERROR พร้อมรายการฟิลด์ */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: r.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        details: r.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    return r.data;
  }
}
