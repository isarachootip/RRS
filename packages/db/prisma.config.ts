import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env อยู่ที่ root ของ repo (คำสั่ง pnpm --filter รันจาก packages/db)
config({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
