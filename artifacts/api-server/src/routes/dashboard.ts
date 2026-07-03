import { Router } from "express";
import { db } from "@workspace/db";
import { serviceOrdersTable, techniciansTable } from "@workspace/db";
import { eq, gte, and, sql, count, sum } from "drizzle-orm";

const router = Router();

// Market value reference per formato_servico
const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  outros: 180,
};

function getFormatoAvg(formato: string | null): number {
  if (!formato) return 200;
  return MARKET_RATES[formato] ?? 200;
}

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const unidade = req.query.unidade as string | undefined;
    const unitCond = unidade ? [eq(serviceOrdersTable.unidade, unidade)] : [];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [open] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, eq(serviceOrdersTable.status, "aberta")));
    const [inProg] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, eq(serviceOrdersTable.status, "em_andamento")));
    const [done] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, eq(serviceOrdersTable.status, "concluida")));
    const [cancelled] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, eq(serviceOrdersTable.status, "cancelada")));
    const [today] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, gte(serviceOrdersTable.createdAt, startOfDay)));
    const [month] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, gte(serviceOrdersTable.createdAt, startOfMonth)));
    const [year] = await db.select({ count: count() }).from(serviceOrdersTable).where(and(...unitCond, gte(serviceOrdersTable.createdAt, startOfYear)));

    const categories = await db
      .select({ category: serviceOrdersTable.category, count: count() })
      .from(serviceOrdersTable)
      .where(unitCond.length ? and(...unitCond) : undefined)
      .groupBy(serviceOrdersTable.category);

    const priorities = await db
      .select({ priority: serviceOrdersTable.priority, count: count() })
      .from(serviceOrdersTable)
      .where(unitCond.length ? and(...unitCond) : undefined)
      .groupBy(serviceOrdersTable.priority);

    // Sum of estimated values (stored or derived from formato)
    const allOrders = await db.select({ estimatedValue: serviceOrdersTable.estimatedValue, formatoServico: serviceOrdersTable.formatoServico })
      .from(serviceOrdersTable)
      .where(unitCond.length ? and(...unitCond) : undefined);
    const totalEstimatedValue = allOrders.reduce((acc, o) => {
      if (o.estimatedValue !== null && o.estimatedValue !== undefined) return acc + Number(o.estimatedValue);
      return acc + getFormatoAvg(o.formatoServico);
    }, 0);

    const totalCount = Number(open.count) + Number(inProg.count) + Number(done.count) + Number(cancelled.count);
    const completionRate = totalCount > 0 ? Math.round((Number(done.count) / totalCount) * 100) : 0;

    res.json({
      totalOpen: Number(open.count),
      totalInProgress: Number(inProg.count),
      totalCompleted: Number(done.count),
      totalCancelled: Number(cancelled.count),
      totalToday: Number(today.count),
      totalThisMonth: Number(month.count),
      totalThisYear: Number(year.count),
      completionRate,
      totalEstimatedValue: Math.round(totalEstimatedValue * 100) / 100,
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
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        points.push({ label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start, end });
      }
    } else if (period === "monthly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        points.push({ label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), start: d, end });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        points.push({ label: String(year), start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) });
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

// GET /dashboard/indicators
router.get("/dashboard/indicators", async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const unidade = req.query.unidade as string | undefined;
    const dateParam = req.query.date as string | undefined;
    let rangeStart: Date;
    let rangeEnd: Date;
    if (dateParam) {
      const parsed = new Date(`${dateParam}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        rangeStart = parsed;
        rangeEnd = new Date(parsed);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
      } else {
        rangeStart = new Date(year, 0, 1);
        rangeEnd = new Date(year + 1, 0, 1);
      }
    } else {
      rangeStart = new Date(year, 0, 1);
      rangeEnd = new Date(year + 1, 0, 1);
    }

    const indicatorConditions: any[] = [
      gte(serviceOrdersTable.createdAt, rangeStart),
      sql`${serviceOrdersTable.createdAt} < ${rangeEnd}`,
    ];
    if (unidade) indicatorConditions.push(eq(serviceOrdersTable.unidade, unidade));

    const allOrders = await db
      .select({
        id: serviceOrdersTable.id,
        location: serviceOrdersTable.location,
        status: serviceOrdersTable.status,
        technicianId: serviceOrdersTable.technicianId,
        formatoServico: serviceOrdersTable.formatoServico,
        estimatedValue: serviceOrdersTable.estimatedValue,
        createdAt: serviceOrdersTable.createdAt,
      })
      .from(serviceOrdersTable)
      .where(and(...indicatorConditions));

    // Fetch technicians for names
    const techs = await db.select().from(techniciansTable);
    const techMap = new Map(techs.map((t) => [t.id, t.name]));

    // Helper to get effective value
    const getValue = (o: typeof allOrders[0]) => {
      if (o.estimatedValue !== null && o.estimatedValue !== undefined) return Number(o.estimatedValue);
      return getFormatoAvg(o.formatoServico);
    };

    // BY LOCATION
    const locationMap = new Map<string, { total: number; completed: number; value: number }>();
    for (const o of allOrders) {
      const loc = o.location || "Não informado";
      if (!locationMap.has(loc)) locationMap.set(loc, { total: 0, completed: 0, value: 0 });
      const entry = locationMap.get(loc)!;
      entry.total++;
      if (o.status === "concluida") entry.completed++;
      entry.value += getValue(o);
    }
    const byLocation = Array.from(locationMap.entries())
      .map(([location, d]) => ({ location, total: d.total, completed: d.completed, estimatedValue: Math.round(d.value * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // BY MONTH
    const monthMap = new Map<string, { total: number; completed: number; value: number }>();
    for (const o of allOrders) {
      const d = new Date(o.createdAt);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!monthMap.has(key)) monthMap.set(key, { total: 0, completed: 0, value: 0 });
      const entry = monthMap.get(key)!;
      entry.total++;
      if (o.status === "concluida") entry.completed++;
      entry.value += getValue(o);
    }
    // Ensure all 12 months present, in order
    const months: string[] = [];
    for (let m = 0; m < 12; m++) {
      months.push(new Date(year, m, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }));
    }
    const byMonth = months.map((month) => {
      const d = monthMap.get(month) ?? { total: 0, completed: 0, value: 0 };
      return { month, total: d.total, completed: d.completed, estimatedValue: Math.round(d.value * 100) / 100 };
    });

    // BY TECHNICIAN
    const techMapAgg = new Map<string, { total: number; completed: number; value: number }>();
    for (const o of allOrders) {
      const name = o.technicianId ? (techMap.get(o.technicianId) ?? "Não atribuído") : "Não atribuído";
      if (!techMapAgg.has(name)) techMapAgg.set(name, { total: 0, completed: 0, value: 0 });
      const entry = techMapAgg.get(name)!;
      entry.total++;
      if (o.status === "concluida") entry.completed++;
      entry.value += getValue(o);
    }
    const byTechnician = Array.from(techMapAgg.entries())
      .map(([technicianName, d]) => ({ technicianName, total: d.total, completed: d.completed, estimatedValue: Math.round(d.value * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    // BY FORMATO SERVICO
    const formatoMap = new Map<string, { total: number; value: number }>();
    for (const o of allOrders) {
      const fmt = o.formatoServico || "outros";
      if (!formatoMap.has(fmt)) formatoMap.set(fmt, { total: 0, value: 0 });
      const entry = formatoMap.get(fmt)!;
      entry.total++;
      entry.value += getValue(o);
    }
    const byFormatoServico = Array.from(formatoMap.entries()).map(([formato, d]) => ({
      formato,
      total: d.total,
      estimatedValue: Math.round(d.value * 100) / 100,
      avgValuePerService: d.total > 0 ? Math.round((d.value / d.total) * 100) / 100 : 0,
    }));

    const totalValue = allOrders.reduce((acc, o) => acc + getValue(o), 0);

    res.json({
      totalValue: Math.round(totalValue * 100) / 100,
      byLocation,
      byMonth,
      byTechnician,
      byFormatoServico,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
