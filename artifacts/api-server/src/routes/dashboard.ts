import { Router } from "express";
import { db } from "@workspace/db";
import { serviceOrdersTable } from "@workspace/db";
import { eq, gte, and, sql, count } from "drizzle-orm";

const router = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [all] = await db.select({ count: count() }).from(serviceOrdersTable);
    const [open] = await db.select({ count: count() }).from(serviceOrdersTable).where(eq(serviceOrdersTable.status, "aberta"));
    const [inProg] = await db.select({ count: count() }).from(serviceOrdersTable).where(eq(serviceOrdersTable.status, "em_andamento"));
    const [done] = await db.select({ count: count() }).from(serviceOrdersTable).where(eq(serviceOrdersTable.status, "concluida"));
    const [cancelled] = await db.select({ count: count() }).from(serviceOrdersTable).where(eq(serviceOrdersTable.status, "cancelada"));
    const [today] = await db.select({ count: count() }).from(serviceOrdersTable).where(gte(serviceOrdersTable.createdAt, startOfDay));
    const [month] = await db.select({ count: count() }).from(serviceOrdersTable).where(gte(serviceOrdersTable.createdAt, startOfMonth));
    const [year] = await db.select({ count: count() }).from(serviceOrdersTable).where(gte(serviceOrdersTable.createdAt, startOfYear));

    const categories = await db
      .select({ category: serviceOrdersTable.category, count: count() })
      .from(serviceOrdersTable)
      .groupBy(serviceOrdersTable.category);

    const priorities = await db
      .select({ priority: serviceOrdersTable.priority, count: count() })
      .from(serviceOrdersTable)
      .groupBy(serviceOrdersTable.priority);

    const total = Number(all.count);
    const completionRate = total > 0 ? Math.round((Number(done.count) / total) * 100) : 0;

    res.json({
      totalOpen: Number(open.count),
      totalInProgress: Number(inProg.count),
      totalCompleted: Number(done.count),
      totalCancelled: Number(cancelled.count),
      totalToday: Number(today.count),
      totalThisMonth: Number(month.count),
      totalThisYear: Number(year.count),
      completionRate,
      byCategory: categories.map((c) => ({ category: c.category, count: Number(c.count) })),
      byPriority: priorities.map((p) => ({ priority: p.priority, count: Number(p.count) })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /dashboard/stats
router.get("/dashboard/stats", async (req, res) => {
  try {
    const period = (req.query.period as string) || "monthly";
    const now = new Date();
    const points: { label: string; start: Date; end: Date }[] = [];

    if (period === "daily") {
      // Last 14 days
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        points.push({
          label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          start,
          end,
        });
      }
    } else if (period === "monthly") {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        points.push({
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          start: d,
          end,
        });
      }
    } else {
      // Last 5 years
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        points.push({
          label: String(year),
          start: new Date(year, 0, 1),
          end: new Date(year + 1, 0, 1),
        });
      }
    }

    const stats = await Promise.all(
      points.map(async ({ label, start, end }) => {
        const [total] = await db.select({ count: count() }).from(serviceOrdersTable)
          .where(and(gte(serviceOrdersTable.createdAt, start), sql`${serviceOrdersTable.createdAt} < ${end}`));
        const [completed] = await db.select({ count: count() }).from(serviceOrdersTable)
          .where(and(eq(serviceOrdersTable.status, "concluida"), gte(serviceOrdersTable.createdAt, start), sql`${serviceOrdersTable.createdAt} < ${end}`));
        const [open] = await db.select({ count: count() }).from(serviceOrdersTable)
          .where(and(eq(serviceOrdersTable.status, "aberta"), gte(serviceOrdersTable.createdAt, start), sql`${serviceOrdersTable.createdAt} < ${end}`));
        const [inProgress] = await db.select({ count: count() }).from(serviceOrdersTable)
          .where(and(eq(serviceOrdersTable.status, "em_andamento"), gte(serviceOrdersTable.createdAt, start), sql`${serviceOrdersTable.createdAt} < ${end}`));

        return {
          label,
          total: Number(total.count),
          completed: Number(completed.count),
          open: Number(open.count),
          inProgress: Number(inProgress.count),
        };
      })
    );

    res.json(stats);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
