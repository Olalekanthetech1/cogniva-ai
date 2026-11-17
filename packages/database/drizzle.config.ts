import { defineConfig } from "drizzle-kit";

const migrationDatabaseUrl =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./schema/**/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  ...(migrationDatabaseUrl
    ? { dbCredentials: { url: migrationDatabaseUrl } }
    : {})
});
