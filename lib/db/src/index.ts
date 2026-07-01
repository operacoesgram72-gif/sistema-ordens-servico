import dns from "dns";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// Supabase DB endpoint resolves to IPv6 only; force IPv6-first so pg
// dns.lookup() can resolve the hostname instead of returning ENOTFOUND.
dns.setDefaultResultOrder("ipv6first");

const { Pool } = pg;

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // Construct from individual PG* vars, encoding special chars correctly
  const host = process.env.PGHOST;
  const port = process.env.PGPORT ?? "5432";
  const database = process.env.PGDATABASE ?? "postgres";
  const user = process.env.PGUSER ?? "";
  const password = process.env.PGPASSWORD ?? "";

  if (!host) {
    throw new Error(
      "No database connection configured. Set DATABASE_URL or PGHOST.",
    );
  }

  const u = new URL("postgresql://x");
  u.hostname = host;
  u.port = port;
  u.pathname = `/${database}`;
  u.username = user;
  u.password = password;
  u.searchParams.set("sslmode", "require");
  return u.href;
}

const connectionString = buildDatabaseUrl();

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
