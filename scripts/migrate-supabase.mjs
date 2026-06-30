import dns from "dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv6first");

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const DDL = `
CREATE TABLE IF NOT EXISTS "technicians" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "specialty" text NOT NULL,
  "phone" text,
  "email" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "number" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "priority" text DEFAULT 'media' NOT NULL,
  "status" text DEFAULT 'aberta' NOT NULL,
  "location" text NOT NULL,
  "department" text,
  "technician_id" integer,
  "technician_name_free" text,
  "notes" text,
  "tipo" text,
  "formato_servico" text,
  "photos" text,
  "signature" text,
  "signed_by" text,
  "signed_at" timestamp,
  "estimated_value" numeric,
  "scheduled_at" timestamp,
  "completed_at" timestamp,
  "unidade" text DEFAULT 'AM' NOT NULL,
  "origem" text DEFAULT 'manual' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_orders_number_unique" UNIQUE("number")
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "cpf" text,
  "phone" text,
  "email" text,
  "address" text,
  "birth_date" date,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "value" text,
  "label" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "settings_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "material_withdrawals" (
  "id" serial PRIMARY KEY NOT NULL,
  "unidade" text DEFAULT 'AM' NOT NULL,
  "date" text NOT NULL,
  "tipo_material" text NOT NULL,
  "quantidade" text NOT NULL,
  "justificativa" text NOT NULL,
  "foto" text,
  "tipo" text DEFAULT 'retirada' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "file_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "unidade" text DEFAULT 'AM' NOT NULL,
  "parent_id" integer,
  "name" text NOT NULL,
  "is_folder" integer DEFAULT 0 NOT NULL,
  "file_data" text,
  "file_type" text,
  "file_size" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run() {
  console.log("Connecting to Supabase...");
  const client = await pool.connect();
  try {
    console.log("Connected! Running migrations...");
    await client.query(DDL);
    console.log("✓ All tables created successfully");

    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('technicians','service_orders','contacts','settings','material_withdrawals','file_entries')
      ORDER BY tablename
    `);
    console.log("Tables verified in Supabase:");
    rows.forEach(r => console.log("  ✓", r.tablename));

    const version = await client.query("SELECT version()");
    console.log("PostgreSQL:", version.rows[0].version.split(" ").slice(0,2).join(" "));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
