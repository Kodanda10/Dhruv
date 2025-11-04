#!/usr/bin/env node
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const migrationsDir = path.resolve("infra/migrations");
if (!fs.existsSync(migrationsDir)) {
  console.error("❌ No infra/migrations folder found.");
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const fullPath = path.join(migrationsDir, file);
  console.log(`🚀 Applying migration: ${file}`);
  try {
    execSync(`psql "$DATABASE_URL" -f "${fullPath}"`, { stdio: "inherit" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`⚠️ Migration failed: ${file}`, message);
    process.exit(1);
  }
}
console.log("✅ All migrations applied successfully.");
