import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Reads the systemActive flag from the settings table.
 * Defaults to `true` (active) when the key has not been written yet, and on
 * any DB error — so a misconfigured database never accidentally locks everyone out.
 */
export async function isSystemActive(): Promise<boolean> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "systemActive"));
    if (rows.length === 0) return true;
    return rows[0].value !== "false";
  } catch {
    return true;
  }
}
