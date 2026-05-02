#!/usr/bin/env tsx
/**
 * scripts/force-tenant.ts
 *
 * Updates the FORCE_TENANT_SLUG line in .env for local development.
 * This makes all requests behave as if they belong to the specified tenant,
 * regardless of JWT token.
 *
 * Usage:
 *   tsx scripts/force-tenant.ts demo           # Force to "demo" tenant
 *   tsx scripts/force-tenant.ts --clear        # Remove the force (comment it out)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const args = process.argv.slice(2);
const clear = args.includes("--clear");
const slug = clear ? "" : args.find((a) => !a.startsWith("--"));

if (!clear && !slug) {
  console.error("❌ Provide a tenant slug or --clear");
  console.error("   Usage: tsx scripts/force-tenant.ts <slug>");
  console.error("   Usage: tsx scripts/force-tenant.ts --clear");
  process.exit(1);
}

let content: string;
try {
  content = readFileSync(envPath, "utf-8");
} catch {
  console.error(`❌ Could not read ${envPath}`);
  process.exit(1);
}

const forceLineRegex = /^#?\s*FORCE_TENANT_SLUG\s*=.*$/m;

let newContent: string;
if (clear) {
  // Comment out the line
  if (forceLineRegex.test(content)) {
    newContent = content.replace(forceLineRegex, "# FORCE_TENANT_SLUG=");
  } else {
    newContent = content + "\n# FORCE_TENANT_SLUG=";
  }
  console.log("✅ FORCE_TENANT_SLUG cleared (commented out)");
} else {
  const newLine = `FORCE_TENANT_SLUG=${slug}`;
  if (forceLineRegex.test(content)) {
    newContent = content.replace(forceLineRegex, newLine);
  } else {
    newContent = content + `\n${newLine}`;
  }
  console.log(`✅ FORCE_TENANT_SLUG set to "${slug}"`);
  console.log("   Restart the API server for the change to take effect.");
}

writeFileSync(envPath, newContent, "utf-8");
