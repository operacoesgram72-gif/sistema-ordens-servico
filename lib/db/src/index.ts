import dns from "dns";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// Supabase DB endpoint resolves to IPv6 only; force IPv6-first so pg
// dns.lookup() can resolve the hostname instead of returning ENOTFOUND.
dns.setDefaultResultOrder("ipv6first");

const { Pool } = pg;

function buildDatabaseUrl(): string {
  // Prefer explicit DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Build from individual vars — SUPABASE_DB_PASSWORD is the shared env var
  // VITE_SUPABASE_URL gives us the project ref (e.g. ubxwxjruivuvjednkctd)
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;

  const password = process.env.SUPABASE_DB_PASSWORD ?? "";
  const pgHost = process.env.PGHOST ?? (projectRef ? `db.${projectRef}.supabase.co` : "");
  const pgPort = process.env.PGPORT ?? "5432";
  const pgUser = process.env.PGUSER ?? "postgres";
  const pgDatabase = process.env.PGDATABASE ?? "postgres";
  const pgPassword = process.env.PGPASSWORD ?? password;

  if (!pgHost) {
    throw new Error(
      "No database connection configured. Set DATABASE_URL or SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL.",
    );
  }

  const u = new URL("postgresql://x");
  u.hostname = pgHost;
  u.port = pgPort;
  u.pathname = `/${pgDatabase}`;
  u.username = pgUser;
  u.password = pgPassword;
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
