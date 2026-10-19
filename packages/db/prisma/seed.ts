import { PrismaClient } from "@prisma/client";
import { seed } from "../src/seed";

const prisma = new PrismaClient();
seed(prisma)
  .then((r) =>
    console.log(`seed เสร็จ: ผู้ใช้ ${r.users}, เจ้าของ ${r.owners}, สินทรัพย์ ${r.assets}, lead ${r.leads}`),
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
