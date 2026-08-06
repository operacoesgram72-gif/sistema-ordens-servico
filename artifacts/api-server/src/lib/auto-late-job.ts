import { db, serviceOrdersTable } from "@workspace/db";
import { and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Marks non-terminal service orders older than 10 days as "atrasada".
 * Runs at startup and every hour via startAutoLateScheduler().
 */
export async function runAutoLateJob(): Promise<void> {
  try {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const updated = await db
      .update(serviceOrdersTable)
      .set({ status: "atrasada", updatedAt: new Date() })
      .where(
        and(
          lt(serviceOrdersTable.createdAt, tenDaysAgo),
          // Exclude terminal/already-late statuses using a raw SQL fragment
          // so we don't need to import the full status enum here.
          sql`${serviceOrdersTable.status} NOT IN ('concluida', 'cancelada', 'atrasada')`
        )
      )
      .returning({ id: serviceOrdersTable.id, number: serviceOrdersTable.number });

    if (updated.length > 0) {
      logger.info(
        { count: updated.length, numbers: updated.map((o) => o.number) },
        "Auto-late: OS marcadas como Atrasada"
      );
    }
  } catch (err) {
    logger.error({ err }, "Auto-late job: erro ao executar");
  }
}

export function startAutoLateScheduler(): void {
  // Run once immediately at startup, then every hour
  void runAutoLateJob();
  setInterval(() => void runAutoLateJob(), 60 * 60 * 1000);
  logger.info("Auto-late scheduler iniciado (intervalo: 1h)");
}
