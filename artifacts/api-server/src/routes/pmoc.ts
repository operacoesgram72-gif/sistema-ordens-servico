import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// Allowed storage key patterns: pmoc_main, pmoc_state_<name>
// This prevents arbitrary namespace access while keeping the key scheme open
// to the fixed set used by the frontend.
const VALID_STORAGE_KEY = /^pmoc_(main|state_[a-z]+)$/;

function validateKey(key: string): boolean {
  return VALID_STORAGE_KEY.test(key);
}

// GET /pmoc/:storageKey — returns the rows array for a given storage key.
// Responds with [] when no record exists yet (empty === authoritative empty).
router.get("/pmoc/:storageKey", async (req, res) => {
  const { storageKey } = req.params;
  if (!validateKey(storageKey)) {
    return res.status(400).json({ error: "Invalid storageKey" });
  }
  try {
    const result = await db.execute(
      sql`SELECT rows, (rows IS NOT NULL) AS found
          FROM pmoc_data WHERE storage_key = ${storageKey}`
    );
    if (result.rows.length === 0) {
      // Key does not exist yet — tell the client so it can keep local data
      return res.status(404).json({ error: "not found" });
    }
    return res.json({ rows: (result.rows[0] as any).rows ?? [] });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to load PMOC data" });
  }
});

// PUT /pmoc/:storageKey — upserts the rows array for a given storage key.
router.put("/pmoc/:storageKey", async (req, res) => {
  const { storageKey } = req.params;
  if (!validateKey(storageKey)) {
    return res.status(400).json({ error: "Invalid storageKey" });
  }
  const { rows } = req.body as { rows: unknown[] };
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "rows must be an array" });
  }
  try {
    await db.execute(
      sql`INSERT INTO pmoc_data (storage_key, rows, updated_at)
          VALUES (${storageKey}, ${JSON.stringify(rows)}::jsonb, now())
          ON CONFLICT (storage_key)
          DO UPDATE SET rows = EXCLUDED.rows, updated_at = now()`
    );
    return res.json({ ok: true });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to save PMOC data" });
  }
});

export default router;
