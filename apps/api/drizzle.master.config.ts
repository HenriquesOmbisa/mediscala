import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const masterUrl = process.env.MASTER_DATABASE_URL;
if (!masterUrl) {
  throw new Error("MASTER_DATABASE_URL is required for Drizzle config");
}

export default defineConfig({
  schema: "./src/db/schema.master.ts",
  out: "./drizzle/master",
  dialect: "postgresql",
  dbCredentials: {
    url: masterUrl,
  },
  verbose: true,
  strict: true,
});
