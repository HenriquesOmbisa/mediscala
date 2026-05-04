import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const masterUrl = process.env.MASTER_DATABASE_URL;
if (!masterUrl) {
  throw new Error("MASTER_DATABASE_URL is required for Drizzle config");
}

const tenantSlug = process.env.DRIZZLE_TENANT_SLUG ?? "demo";
const tenantUrl = new URL(masterUrl);
tenantUrl.pathname = `/mediscala_${tenantSlug}`;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/tenant",
  dialect: "postgresql",
  dbCredentials: {
    url: tenantUrl.toString(),
  },
  verbose: true,
  strict: true,
});
