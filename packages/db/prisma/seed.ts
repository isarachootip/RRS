import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { seed } from "../src/seed";

const prisma = new PrismaClient();

async function ensureSysadmin() {
  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!adminRole) return;
  const passwordHash = await hash("oil10041969*", { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const user = await prisma.user.upsert({
    where: { email: "sysadmin@rrs.local" },
    update: {
      passwordHash,
      isActive: true,
      totpEnabled: false,
      totpSecret: null,
      lockedUntil: null,
      failedLoginCount: 0,
    },
    create: {
      email: "sysadmin@rrs.local",
      fullName: "System Administrator (sysadmin)",
      nickname: "sysadmin",
      passwordHash,
      isActive: true,
      totpEnabled: false,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
}

seed(prisma)
  .then(async (r) => {
    await ensureSysadmin();
    console.log(`seed เสร็จ: ผู้ใช้ ${r.users}, เจ้าของ ${r.owners}, สินทรัพย์ ${r.assets}, lead ${r.leads}`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
