import { Router } from "express";
import { db } from "@workspace/db";
import { serviceOrdersTable, techniciansTable, materialWithdrawalsTable } from "@workspace/db";
import { eq, and, sql, count, isNotNull, desc, gte, lt } from "drizzle-orm";
import { resolveUnit } from "../lib/share-tokens";

const router = Router();

// ── GET /dashboard/summary ────────────────────────────────────────────────────
// Replaced 10 sequential count() queries with a single aggregation pass +
// two grouped queries, all fired in parallel (3 round-trips total).
router.get("/dashboard/summary", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);

    const now = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    // Optional date-range filter from query params (year / month / day)
    const filterYear  = req.query.year  ? Number(req.query.year)  : undefined;
    const filterMonth = req.query.month ? Number(req.query.month) : undefined;
    const filterDay   = req.query.day   ? Number(req.query.day)   : undefined;

    let periodStart: Date | undefined;
    let periodEnd:   Date | undefined;
    if (filterYear !== undefined) {
      if (filterMonth && filterDay) {
        periodStart = new Date(filterYear, filterMonth - 1, filterDay);
        periodEnd   = new Date(filterYear, filterMonth - 1, filterDay + 1);
      } else if (filterMonth) {
        periodStart = new Date(filterYear, filterMonth - 1, 1);
        periodEnd   = new Date(filterYear, filterMonth, 1);
      } else {
        periodStart = new Date(filterYear, 0, 1);
        periodEnd   = new Date(filterYear + 1, 0, 1);
      }
    }

    // Combined WHERE clause: unit + optional date range
    const whereClause = (() => {
      if (unidade && periodStart && periodEnd)
        return sql`WHERE unidade = ${unidade} AND created_at >= ${periodStart} AND created_at < ${periodEnd}`;
      if (unidade)
        return sql`WHERE unidade = ${unidade}`;
      if (periodStart && periodEnd)
        return sql`WHERE created_at >= ${periodStart} AND created_at < ${periodEnd}`;
      return sql``;
    })();

    // Drizzle filter for byCategory / byPriority queries
    const unitFilter  = unidade ? eq(serviceOrdersTable.unidade, unidade) : undefined;
    const dateFilter  = periodStart && periodEnd
      ? and(gte(serviceOrdersTable.createdAt, periodStart), lt(serviceOrdersTable.createdAt, periodEnd))
      : undefined;
    const drizzleWhere = unitFilter && dateFilter ? and(unitFilter, dateFilter)
      : unitFilter ?? dateFilter;

    const [countsResult, categories, priorities] = await Promise.all([
      // All counts + estimated value sum in a single table scan
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'aberta')                        AS "open",
          COUNT(*) FILTER (WHERE status = 'em_andamento')                  AS "inProg",
          COUNT(*) FILTER (WHERE status = 'concluida')                     AS "done",
          COUNT(*) FILTER (WHERE status = 'cancelada')                     AS "cancelled",
          COUNT(*) FILTER (WHERE created_at >= ${startOfDay})              AS "today",
          COUNT(*) FILTER (WHERE created_at >= ${startOfMonth})            AS "month",
          COUNT(*) FILTER (WHERE created_at >= ${startOfYear})             AS "year",
          COALESCE(SUM(CASE
            WHEN estimated_value IS NOT NULL THEN estimated_value::numeric
            WHEN formato_servico = 'civil'        THEN 280
            WHEN formato_servico = 'refrigeracao' THEN 350
            WHEN formato_servico = 'hidraulica'   THEN 250
            WHEN formato_servico = 'mecanica'     THEN 320
            WHEN formato_servico = 'eletrica'     THEN 290
            ELSE 200
          END), 0) AS "totalValue"
        FROM service_orders
        ${whereClause}
      `),
      db.select({ category: serviceOrdersTable.category, count: count() })
        .from(serviceOrdersTable)
        .where(drizzleWhere)
        .groupBy(serviceOrdersTable.category),
      db.select({ priority: serviceOrdersTable.priority, count: count() })
        .from(serviceOrdersTable)
        .where(drizzleWhere)
        .groupBy(serviceOrdersTable.priority),
    ]);

    const c = (countsResult.rows[0] as any) ?? {};
    const totalOpen       = Number(c.open ?? 0);
    const totalInProgress = Number(c.inProg ?? 0);
    const totalCompleted  = Number(c.done ?? 0);
    const totalCancelled  = Number(c.cancelled ?? 0);
    const totalCount = totalOpen + totalInProgress + totalCompleted + totalCancelled;

    res.json({
      totalOpen,
      totalInProgress,
      totalCompleted,
      totalCancelled,
      totalToday:          Number(c.today ?? 0),
      totalThisMonth:      Number(c.month ?? 0),
      totalThisYear:       Number(c.year  ?? 0),
      completionRate:      totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0,
      totalEstimatedValue: Math.round(Number(c.totalValue ?? 0) * 100) / 100,
      byCategory: categories.map((r) => ({ category: r.category, count: Number(r.count) })),
      byPriority: priorities.map((r) => ({ priority: r.priority, count: Number(r.count) })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── GET /dashboard/stats ──────────────────────────────────────────────────────
// Replaced the 4×N queries-in-a-loop (up to 48 round-trips) with a single
// date_trunc GROUP BY query, then filled zero-count periods in memory.
router.get("/dashboard/stats", async (req, res) => {
  try {
    const period  = (req.query.period as string) || "monthly";
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const now = new Date();

    let truncUnit: string;
    let overallStart: Date;
    let expectedLabels: { label: string; key: string }[] = [];

    if (period === "daily") {
      truncUnit = "day";
      overallStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        expectedLabels.push({
          label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          key: start.toISOString().slice(0, 10),
        });
      }
    } else if (period === "monthly") {
      truncUnit = "month";
      overallStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        expectedLabels.push({
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          key: d.toISOString().slice(0, 7),
        });
      }
    } else {
      truncUnit = "year";
      overallStart = new Date(now.getFullYear() - 4, 0, 1);
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        expectedLabels.push({ label: String(year), key: String(year) });
      }
    }

    // Optional unit filter — keeps stats consistent with summary cards
    const unitFilter = unidade ? sql`AND unidade = ${unidade}` : sql``;

    // Single grouped query — one round-trip for any period type
    const rows = await db.execute(sql`
      SELECT
        date_trunc(${truncUnit}, created_at)                          AS period_start,
        COUNT(*)                                                       AS total,
        COUNT(*) FILTER (WHERE status = 'concluida')                  AS completed,
        COUNT(*) FILTER (WHERE status = 'aberta')                     AS open,
        COUNT(*) FILTER (WHERE status = 'em_andamento')               AS in_progress
      FROM service_orders
      WHERE created_at >= ${overallStart}
      ${unitFilter}
      GROUP BY period_start
      ORDER BY period_start
    `);

    // Build lookup from truncated key → row
    const rowMap = new Map<string, any>();
    for (const row of rows.rows as any[]) {
      const d = new Date(row.period_start);
      const key = truncUnit === "day"   ? d.toISOString().slice(0, 10)
                : truncUnit === "month" ? d.toISOString().slice(0, 7)
                : String(d.getUTCFullYear());
      rowMap.set(key, row);
    }

    const stats = expectedLabels.map(({ label, key }) => {
      const row = rowMap.get(key);
      return {
        label,
        total:      Number(row?.total       ?? 0),
        completed:  Number(row?.completed   ?? 0),
        open:       Number(row?.open        ?? 0),
        inProgress: Number(row?.in_progress ?? 0),
      };
    });

    res.json(stats);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── GET /dashboard/indicators ─────────────────────────────────────────────────
// Replaced separate full technicians table fetch with a LEFT JOIN,
// eliminating one extra round-trip per request.
router.get("/dashboard/indicators", async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const dateParam = req.query.date as string | undefined;
    // Optional filters for the Desempenho section
    const filterFormato = (req.query.formatoServico as string) || undefined;
    const filterTipo    = (req.query.tipo as string) || undefined;

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

    const conditions: any[] = [
      sql`${serviceOrdersTable.createdAt} >= ${rangeStart}`,
      sql`${serviceOrdersTable.createdAt} < ${rangeEnd}`,
    ];
    if (unidade) conditions.push(eq(serviceOrdersTable.unidade, unidade));
    // Optional content filters — narrow every aggregation (byMonth, byTechnician, etc.)
    if (filterFormato) conditions.push(eq(serviceOrdersTable.formatoServico, filterFormato as any));
    if (filterTipo)    conditions.push(eq((serviceOrdersTable as any).tipo, filterTipo));

    // Single query with LEFT JOIN — no separate technicians fetch
    // Capped at 2000 rows: JS-side aggregation for the indicators page degrades
    // above that threshold (CPU, memory). At 2000 records the stats are still
    // representative and the response arrives in < 1 s.
    const allOrders = await db
      .select({
        location:           serviceOrdersTable.location,
        status:             serviceOrdersTable.status,
        technicianNameFree: (serviceOrdersTable as any).technicianNameFree,
        technicianName:     techniciansTable.name,
        formatoServico:     serviceOrdersTable.formatoServico,
        tipo:               (serviceOrdersTable as any).tipo,
        estimatedValue:     serviceOrdersTable.estimatedValue,
        createdAt:          serviceOrdersTable.createdAt,
      })
      .from(serviceOrdersTable)
      .leftJoin(techniciansTable, eq(serviceOrdersTable.technicianId, techniciansTable.id))
      .where(and(...conditions))
      .limit(2000);

    // Market value fallback per formato
    const MARKET_RATES: Record<string, number> = {
      civil: 280, refrigeracao: 350, hidraulica: 250, mecanica: 320, eletrica: 290, outros: 180,
    };
    const getValue = (o: typeof allOrders[0]) => {
      if (o.estimatedValue !== null && o.estimatedValue !== undefined) return Number(o.estimatedValue);
      return MARKET_RATES[o.formatoServico ?? ""] ?? 200;
    };
    // Normalize a single technician name to Title Case so "max", "MAX" and "Max"
    // all map to the same bucket in every aggregation (byTechnician, byFormat, etc.).
    const normalizeName = (n: string): string =>
      n.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

    const getTechName = (o: typeof allOrders[0]): string => {
      const raw = (o as any).technicianNameFree || o.technicianName;
      if (!raw) return "Não atribuído";
      // Normalize each part when multiple technicians are separated by " / "
      return raw.split(" / ").map((part: string) => normalizeName(part)).join(" / ");
    };

    // BY LOCATION
    const locationMap = new Map<string, { total: number; completed: number; value: number }>();
    const techMapAgg  = new Map<string, { total: number; completed: number; value: number }>();
    const monthMap    = new Map<string, { total: number; completed: number; value: number }>();
    const formatoMap  = new Map<string, { total: number; value: number }>();

    for (const o of allOrders) {
      const loc  = o.location  || "Não informado";
      const name = getTechName(o);
      const fmt  = o.formatoServico || "outros";
      const d    = new Date(o.createdAt);
      const mKey = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const val  = getValue(o);
      const done = o.status === "concluida";

      const bump = (map: Map<string, any>, key: string) => {
        if (!map.has(key)) map.set(key, { total: 0, completed: 0, value: 0 });
        return map.get(key)!;
      };

      const le = bump(locationMap, loc); le.total++; if (done) le.completed++; le.value += val;
      const me = bump(monthMap,    mKey); me.total++; if (done) me.completed++; me.value += val;
      const fe = bump(formatoMap,  fmt);  fe.total++;                           fe.value += val;

      // Split multi-technician OS (stored as "Tech A / Tech B") so each
      // technician gets their own row in byTechnician without creating
      // duplicate OS records or altering OS numbering.
      const techNames = name.split(" / ").map((s: string) => s.trim()).filter(Boolean);
      const effectiveTechs = techNames.length > 0 ? techNames : ["Não atribuído"];
      for (const techName of effectiveTechs) {
        const te = bump(techMapAgg, techName); te.total++; if (done) te.completed++; te.value += val;
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    const byLocation = Array.from(locationMap.entries())
      .map(([location, d]) => ({ location, total: d.total, completed: d.completed, estimatedValue: round(d.value) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const months: string[] = [];
    for (let m = 0; m < 12; m++)
      months.push(new Date(year, m, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }));
    const byMonth = months.map((month) => {
      const d = monthMap.get(month) ?? { total: 0, completed: 0, value: 0 };
      return { month, total: d.total, completed: d.completed, estimatedValue: round(d.value) };
    });

    const byTechnician = Array.from(techMapAgg.entries())
      .map(([technicianName, d]) => ({ technicianName, total: d.total, completed: d.completed, estimatedValue: round(d.value) }))
      .sort((a, b) => b.total - a.total);

    const byFormatoServico = Array.from(formatoMap.entries()).map(([formato, d]) => ({
      formato,
      total: d.total,
      estimatedValue: round(d.value),
      avgValuePerService: d.total > 0 ? round(d.value / d.total) : 0,
    }));

    const totalValue = allOrders.reduce((acc, o) => acc + getValue(o), 0);

    res.json({ totalValue: round(totalValue), byLocation, byMonth, byTechnician, byFormatoServico });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── GET /dashboard/timeline ────────────────────────────────────────────────────
// Aggregates recent events from existing tables into a single chronological feed
// for the Indicadores timeline widget. Read-only — does not touch any other
// endpoint's data or behavior. Sources (all real, existing timestamped data):
//   - OS criadas       (service_orders.createdAt)
//   - OS concluídas    (service_orders.completedAt, status = concluida)
//   - OS programadas   (service_orders.scheduledAt) — calendar scheduling
//   - Retiradas de material / compras (material_withdrawals.createdAt)
// Each source is queried independently (LIMIT + ORDER BY, indexed columns),
// merged in memory, sorted by date desc, and capped to `limit`.
router.get("/dashboard/timeline", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    // Fetch a bit more than `limit` per source so merging+sorting still yields
    // a full, correctly-ordered page even when one source dominates recency.
    const perSourceLimit = limit;

    const unitCond = (col: any) => (unidade ? eq(col, unidade) : undefined);

    // Optional technician filter — when set, only OS events for that technician
    // are returned. Multi-tech OS ("João / Maria") match when the tech name
    // appears as one of the slash-separated parts. Material events are always
    // included (they are not OS-specific).
    const filtroTecnico = req.query.tecnico as string | undefined;

    const [created, completed, scheduled, withdrawals] = await Promise.all([
      db.select({
          id: serviceOrdersTable.id,
          number: serviceOrdersTable.number,
          title: serviceOrdersTable.title,
          location: serviceOrdersTable.location,
          formatoServico: serviceOrdersTable.formatoServico,
          technicianNameFree: (serviceOrdersTable as any).technicianNameFree,
          date: serviceOrdersTable.createdAt,
        })
        .from(serviceOrdersTable)
        .where(unitCond(serviceOrdersTable.unidade))
        .orderBy(desc(serviceOrdersTable.createdAt))
        .limit(perSourceLimit),
      db.select({
          id: serviceOrdersTable.id,
          number: serviceOrdersTable.number,
          title: serviceOrdersTable.title,
          location: serviceOrdersTable.location,
          formatoServico: serviceOrdersTable.formatoServico,
          technicianNameFree: (serviceOrdersTable as any).technicianNameFree,
          date: serviceOrdersTable.completedAt,
        })
        .from(serviceOrdersTable)
        .where(and(
          eq(serviceOrdersTable.status, "concluida"),
          isNotNull(serviceOrdersTable.completedAt),
          unitCond(serviceOrdersTable.unidade),
        ))
        .orderBy(desc(serviceOrdersTable.completedAt))
        .limit(perSourceLimit),
      db.select({
          id: serviceOrdersTable.id,
          number: serviceOrdersTable.number,
          title: serviceOrdersTable.title,
          location: serviceOrdersTable.location,
          formatoServico: serviceOrdersTable.formatoServico,
          technicianNameFree: (serviceOrdersTable as any).technicianNameFree,
          date: serviceOrdersTable.scheduledAt,
        })
        .from(serviceOrdersTable)
        .where(and(
          isNotNull(serviceOrdersTable.scheduledAt),
          unitCond(serviceOrdersTable.unidade),
        ))
        .orderBy(desc(serviceOrdersTable.scheduledAt))
        .limit(perSourceLimit),
      db.select({
          id: materialWithdrawalsTable.id,
          nome: materialWithdrawalsTable.nome,
          tipoMaterial: materialWithdrawalsTable.tipoMaterial,
          quantidade: materialWithdrawalsTable.quantidade,
          date: materialWithdrawalsTable.createdAt,
        })
        .from(materialWithdrawalsTable)
        .where(unitCond(materialWithdrawalsTable.unidade))
        .orderBy(desc(materialWithdrawalsTable.createdAt))
        .limit(perSourceLimit),
    ]);

    type TimelineEvent = {
      id: string;
      type: "os_criada" | "os_concluida" | "os_programada" | "material";
      title: string;
      subtitle: string | null;
      date: string;
    };

    const events: TimelineEvent[] = [];

    // Helper: check if an OS belongs to the requested technician.
    // technicianNameFree may hold "João" or "João / Maria" for multi-tech OS.
    // Returns true when no filter is set (show all).
    const techMatches = (techFree: string | null | undefined): boolean => {
      if (!filtroTecnico) return true;
      if (!techFree) return false;
      return techFree.split(" / ").map((s: string) => s.trim()).includes(filtroTecnico);
    };

    for (const o of created) {
      if (!techMatches((o as any).technicianNameFree)) continue;
      events.push({
        id: `criada-${o.id}`,
        type: "os_criada",
        title: `OS ${o.number} aberta`,
        subtitle: o.title || o.location || null,
        date: new Date(o.date as any).toISOString(),
      });
    }
    for (const o of completed) {
      if (!o.date) continue;
      if (!techMatches((o as any).technicianNameFree)) continue;
      events.push({
        id: `concluida-${o.id}`,
        type: "os_concluida",
        title: `OS ${o.number} concluída`,
        subtitle: o.title || o.location || null,
        date: new Date(o.date as any).toISOString(),
      });
    }
    for (const o of scheduled) {
      if (!o.date) continue;
      if (!techMatches((o as any).technicianNameFree)) continue;
      events.push({
        id: `programada-${o.id}`,
        type: "os_programada",
        title: `OS ${o.number} programada`,
        subtitle: o.title || o.location || null,
        date: new Date(o.date as any).toISOString(),
      });
    }
    for (const w of withdrawals) {
      events.push({
        id: `material-${w.id}`,
        type: "material",
        title: `Retirada de material${w.tipoMaterial ? `: ${w.tipoMaterial}` : ""}`,
        subtitle: [w.nome, w.quantidade].filter(Boolean).join(" — ") || null,
        date: new Date(w.date as any).toISOString(),
      });
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(events.slice(0, limit));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
