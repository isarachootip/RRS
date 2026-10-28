import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import type { ColumnMappingConfig, ImportEntity } from "./importer.types";
import { runLegacyImport } from "./legacy-importer";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });
const prisma = new PrismaClient();

function resolveInputPath(inputPath: string): string {
  const fromCwd = resolve(process.cwd(), inputPath);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRoot = resolve(process.cwd(), "../..", inputPath);
  if (existsSync(fromRoot)) return fromRoot;
  return fromCwd;
}

async function main() {
  const args = process.argv.slice(2);
  const entityArg = args[0] as ImportEntity | undefined;
  const filePathArg = args[1];

  if (!entityArg || !["owners", "assets", "leads"].includes(entityArg) || !filePathArg) {
    console.error(
      "Usage: pnpm import:<owners|assets|leads> <csv-file> [--config <config.json>] [--dry-run] [--report <report.csv>]",
    );
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");
  const configIdx = args.indexOf("--config");
  const reportIdx = args.indexOf("--report");

  let mapping: Record<string, string> | undefined;
  if (configIdx !== -1 && args[configIdx + 1]) {
    const cfgRaw = readFileSync(resolveInputPath(args[configIdx + 1]!), "utf8");
    const parsedCfg = JSON.parse(cfgRaw) as ColumnMappingConfig;
    mapping = parsedCfg[entityArg];
  }

  const csvContent = readFileSync(resolveInputPath(filePathArg), "utf8");
  const result = await runLegacyImport(prisma, {
    entity: entityArg,
    csvContent,
    dryRun,
    mapping,
  });

  if (reportIdx !== -1 && args[reportIdx + 1]) {
    writeFileSync(resolve(process.cwd(), args[reportIdx + 1]!), result.csvReport, "utf8");
  } else if (dryRun) {
    process.stdout.write(`${result.csvReport}\n`);
  }

  process.stdout.write(
    `${JSON.stringify({
      entity: result.entity,
      dryRun: result.dryRun,
      totalRows: result.totalRows,
      validRows: result.validRows,
      invalidRows: result.invalidRows,
      duplicateRows: result.duplicateRows,
      importedRows: result.importedRows,
    })}\n`,
  );
}

void main().finally(() => prisma.$disconnect());
