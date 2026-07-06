import dns from "dns";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

dns.setDefaultResultOrder("ipv6first");

const { Pool } = pg;

// ── Parse Supabase project ref from VITE_SUPABASE_URL ───────────────────────

function getProjectRef(): string | null {
  const url = process.env.VITE_SUPABASE_URL ?? "";
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

// ── Check whether a hostname has at least one IPv4 (A) record ───────────────

async function hasIPv4(host: string): Promise<boolean> {
  try {
    const addrs = await dns.promises.resolve4(host);
    return addrs.length > 0;
  } catch {
    return false;
  }
}

// ── Discover the Supabase session-pooler hostname (IPv4-capable) ─────────────
//
// The pooler is at  aws-0-{region}.pooler.supabase.com
// We try common regions in order and return the first one that resolves to IPv4.

const POOLER_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "sa-east-1",
];

async function findPoolerHost(): Promise<string | null> {
  const results = await Promise.all(
    POOLER_REGIONS.map(async (r) => {
      const h = `aws-0-${r}.pooler.supabase.com`;
      return (await hasIPv4(h)) ? h : null;
    }),
  );
  return results.find((h) => h !== null) ?? null;
}

// ── Build pool connection params ─────────────────────────────────────────────
//
// Priority:
//   1. DATABASE_URL env var (if non-empty)
//   2. Direct Supabase DB connection (db.{ref}.supabase.co) — IPv4 only
//   3. Supabase session pooler (aws-0-{region}.pooler.supabase.com) — IPv4
//   4. Individual PG* env vars as-is (last resort)

async function buildPool(): Promise<pg.Pool> {
  const password =
    process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || "";

  // 1. DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  }

  const projectRef = getProjectRef();

  // 2. Direct host — only if it has IPv4 (avoid EAFNOSUPPORT)
  const directHost = projectRef ? `db.${projectRef}.supabase.co` : (process.env.PGHOST || "");
  if (directHost && await hasIPv4(directHost)) {
    return new Pool({
      host: directHost,
      port: Number(process.env.PGPORT || "5432"),
      user: process.env.PGUSER || "postgres",
      password: password || process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE || "postgres",
      ssl: { rejectUnauthorized: false },
    });
  }

  // 3. Supabase session pooler (port 5432, IPv4-capable)
  if (projectRef) {
    const poolerHost = await findPoolerHost();
    if (poolerHost) {
      return new Pool({
        host: poolerHost,
        port: 5432,
        // Pooler requires  postgres.{project-ref}  as the username
        user: `postgres.${projectRef}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      });
    }
  }

  // 4. PG* env vars as last resort
  const pgHost = process.env.PGHOST || "";
  if (!pgHost) {
    throw new Error(
      "No database connection configured. Set DATABASE_URL or " +
        "SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL.",
    );
  }
  return new Pool({
    host: pgHost,
    port: Number(process.env.PGPORT || "5432"),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "postgres",
    ssl: { rejectUnauthorized: false },
  });
}

// Top-level await — valid in ESM (.mjs output)
export const pool = await buildPool();
export const db = drizzle(pool, { schema });
export * from "./schema";
