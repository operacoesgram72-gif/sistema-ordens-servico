/**
 * One-off migration script — runs idempotent ALTER TABLE / CREATE TABLE
 * statements to bring the Supabase DB up to the current Drizzle schema.
 * Run with:  node --env-file=... scripts/migrate.mjs
 */

import dns from "dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv6first");
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  // ── suppliers ──────────────────────────────────────────────────────────────
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cnpj_cpf text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS razao_social text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS endereco text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS uf text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cidade text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contato text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS atendente text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS localizacao_link text`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,

  // ── contacts ───────────────────────────────────────────────────────────────
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,

  // ── service_orders ─────────────────────────────────────────────────────────
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS tipo text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS formato_servico text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS photos text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS signature text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS signed_by text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS signed_at timestamptz`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS estimated_value numeric`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS technician_name_free text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS department text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS notes text`,
  `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,

  // ── technicians ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS technicians (
    id         serial PRIMARY KEY,
    name       text NOT NULL,
    specialty  text NOT NULL,
    phone      text,
    email      text,
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS position text`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS manager_id integer`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS photo_url text`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS is_corporate boolean NOT NULL DEFAULT false`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS area text`,
  `ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_manager_id_fkey`,
  `ALTER TABLE technicians
     ADD CONSTRAINT technicians_manager_id_fkey
     FOREIGN KEY (manager_id) REFERENCES technicians(id) ON DELETE SET NULL`,

  // ── material_withdrawals ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS material_withdrawals (
    id           serial PRIMARY KEY,
    unidade      text NOT NULL DEFAULT 'AM',
    nome         text NOT NULL DEFAULT '',
    date         text NOT NULL,
    tipo_material text NOT NULL,
    quantidade   text NOT NULL,
    justificativa text NOT NULL,
    foto         text,
    tipo         text NOT NULL DEFAULT 'retirada',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE material_withdrawals ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE material_withdrawals ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT ''`,
  `ALTER TABLE material_withdrawals ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'retirada'`,
  `ALTER TABLE material_withdrawals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,

  // ── file_entries ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS file_entries (
    id          serial PRIMARY KEY,
    unidade     text NOT NULL DEFAULT 'AM',
    parent_id   integer,
    name        text NOT NULL,
    is_folder   integer NOT NULL DEFAULT 0,
    file_data   text,
    file_type   text,
    file_size   integer,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,

  // ── settings ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS settings (
    id         serial PRIMARY KEY,
    key        text NOT NULL UNIQUE,
    value      text,
    label      text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  // ── links (new table) ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS links (
    id         serial PRIMARY KEY,
    unidade    text NOT NULL DEFAULT 'AM',
    nome       text NOT NULL,
    descricao  text,
    url        text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  // ── purchase_sheets (Compras e Serviços — one workbook per unit) ──────────
  `CREATE TABLE IF NOT EXISTS purchase_sheets (
    id         serial PRIMARY KEY,
    unidade    text NOT NULL,
    data       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE purchase_sheets ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'AM'`,
  `ALTER TABLE purchase_sheets ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE purchase_sheets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,
  `ALTER TABLE purchase_sheets DROP CONSTRAINT IF EXISTS purchase_sheets_unidade_unique`,
  `ALTER TABLE purchase_sheets ADD CONSTRAINT purchase_sheets_unidade_unique UNIQUE (unidade)`,

  // ── pmoc data ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS pmoc_data (
    storage_key text PRIMARY KEY,
    rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,

  // ── performance indexes ────────────────────────────────────────────────────
  // Composite indexes for the most common filtered queries
  `CREATE INDEX IF NOT EXISTS idx_so_unidade_created ON service_orders (unidade, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_so_unidade_status  ON service_orders (unidade, status)`,
  `CREATE INDEX IF NOT EXISTS idx_so_status          ON service_orders (status)`,
  `CREATE INDEX IF NOT EXISTS idx_so_created_at      ON service_orders (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_so_technician_id   ON service_orders (technician_id)`,
  `CREATE INDEX IF NOT EXISTS idx_so_scheduled_at    ON service_orders (scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fe_parent_id       ON file_entries   (parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fe_unidade         ON file_entries   (unidade)`,
  `CREATE INDEX IF NOT EXISTS idx_tech_manager_id    ON technicians    (manager_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tech_unidade       ON technicians    (unidade)`,
  `CREATE INDEX IF NOT EXISTS idx_mw_unidade         ON material_withdrawals (unidade)`,
  `CREATE INDEX IF NOT EXISTS idx_mw_created_at      ON material_withdrawals (created_at DESC)`,

  // ── corporate org-chart roles (shared across all units) ───────────────────
  `INSERT INTO technicians (name, specialty, position, unidade, is_corporate, active)
   SELECT 'Eduardo Lopes', 'Diretoria', 'Diretor de Tecnologia', 'AM', true, true
   WHERE NOT EXISTS (SELECT 1 FROM technicians WHERE name = 'Eduardo Lopes' AND is_corporate = true)`,
  `INSERT INTO technicians (name, specialty, position, unidade, is_corporate, active, manager_id)
   SELECT 'Salvino Guerra', 'Gerência', 'Gerente de Projetos', 'AM', true, true,
     (SELECT id FROM technicians WHERE name = 'Eduardo Lopes' AND is_corporate = true LIMIT 1)
   WHERE NOT EXISTS (SELECT 1 FROM technicians WHERE name = 'Salvino Guerra' AND is_corporate = true)`,
  `INSERT INTO technicians (name, specialty, position, unidade, is_corporate, active, manager_id)
   SELECT 'Marco Carneiro', 'Gerência', 'Gerente de Tecnologia', 'AM', true, true,
     (SELECT id FROM technicians WHERE name = 'Salvino Guerra' AND is_corporate = true LIMIT 1)
   WHERE NOT EXISTS (SELECT 1 FROM technicians WHERE name = 'Marco Carneiro' AND is_corporate = true)`,
];

const client = await pool.connect();
try {
  for (const sql of migrations) {
    const label = sql.trim().slice(0, 80).replace(/\s+/g, " ");
    try {
      await client.query(sql);
      console.log("✅", label);
    } catch (err) {
      console.error("❌", label, "\n  →", err.message);
    }
  }
  console.log("\n✔ Migration complete.");
} finally {
  client.release();
  await pool.end();
}
