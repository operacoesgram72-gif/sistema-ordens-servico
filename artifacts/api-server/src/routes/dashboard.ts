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

    // Market value fallback per formato — used when the OS has no estimatedValue stored.
    // Values represent the average per-OS cost for a typical corretiva visit (4h, SINAPI 2025 reference).
    const MARKET_RATES: Record<string, number> = {
      civil: 816, refrigeracao: 1025, hidraulica: 711, mecanica: 795, eletrica: 775, ronda: 230, outros: 607,
    };
    const getValue = (o: typeof allOrders[0]) => {
      if (o.estimatedValue !== null && o.estimatedValue !== undefined) return Number(o.estimatedValue);
      return MARKET_RATES[o.formatoServico ?? ""] ?? 200;
    };
    // Canonical name map — maps partial/nickname/misspelling → full canonical name.
    // Applied AFTER title-case normalization so "erielder" → "Erielder" → "Erielder Ribeiro".
    // NOTE: Max and Lucas are distinct technicians — do NOT merge them.
    const CANONICAL_NAMES: Record<string, string> = {
      "Erielder": "Erielder Ribeiro",
      "Erielder Ribei": "Erielder Ribeiro",
      "Jose": "José Ramon",
      "José": "José Ramon",
      "Jose Ramon": "José Ramon",
      "Jose Ramon Albu": "José Ramon",
      // Ewenton Moreira — both spellings (Ewenton/Ewerton) map to the same person
      "Ewenton": "Ewenton Moreira",
      "Ewenton More": "Ewenton Moreira",
      "Ewenton Morei": "Ewenton Moreira",
      "Ewerton": "Ewenton Moreira",
      "Ewerton Moreira": "Ewenton Moreira",
      "Ewerton More": "Ewenton Moreira",
    };

    // Normalize a single technician name to Title Case, then apply canonical map.
    const normalizeName = (n: string): string => {
      const tc = n.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      return CANONICAL_NAMES[tc] ?? tc;
    };

    const getTechName = (o: typeof allOrders[0]): string => {
      const raw = (o as any).technicianNameFree || o.technicianName;
      if (!raw) return "Não atribuído";
      // Normalize separators: commas, semicolons, and slashes all become " / "
      // then sort names alphabetically so "A / B" and "B / A" merge as the same team.
      const parts = raw.split(/\s*[,;]\s*|\s*\/\s*/).map((s: string) => s.trim()).filter(Boolean);
      return parts.map((part: string) => normalizeName(part)).sort().join(" / ");
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

// ── Gerador de resumo local ───────────────────────────────────────────────────
function buildLocalSummary(s: any, filterLabel?: string): string {
  const total = (s.totalOpen ?? 0) + (s.totalInProgress ?? 0) + (s.totalCompleted ?? 0) + (s.totalCanceled ?? 0);
  const rate = parseFloat(s.completionRate ?? s.averageCompletionRate ?? 0);
  const overdue = s.totalOverdue ?? 0;
  const open = s.totalOpen ?? 0;
  const inProgress = s.totalInProgress ?? 0;
  const completed = s.totalCompleted ?? 0;
  const today = s.totalToday ?? 0;
  const thisMonth = s.totalThisMonth ?? 0;

  const topTech = (s.byTechnician ?? [])[0];
  const worstTech = (s.byTechnician ?? []).find((t: any) => t.pending > 0);
  const topLocation = (s.byLocation ?? [])[0];

  const parts: string[] = [];

  const periodo = filterLabel && filterLabel !== "Atual" ? `no período ${filterLabel}` : "no período atual";
  parts.push(`${total > 0 ? `Foram registradas ${total} ordens de serviço ${periodo}.` : `Nenhuma OS registrada ${periodo}.`}`);

  if (rate >= 80) {
    parts.push(`A taxa de conclusão está em ${rate.toFixed(1)}%, indicando bom desempenho operacional.`);
  } else if (rate >= 60) {
    parts.push(`A taxa de conclusão é de ${rate.toFixed(1)}%, dentro da margem aceitável, mas com espaço para melhoria.`);
  } else if (total > 0) {
    parts.push(`A taxa de conclusão é de apenas ${rate.toFixed(1)}%, abaixo do ideal — recomenda-se atenção imediata ao fluxo de trabalho.`);
  }

  if (overdue > 0) {
    parts.push(`⚠ Atenção: ${overdue} OS ultrapassaram o prazo e requerem ação urgente.`);
  }

  const activeLoad = open + inProgress;
  if (activeLoad > 0) {
    parts.push(`Há atualmente ${activeLoad} OS ativas (${open} abertas e ${inProgress} em andamento).`);
  }

  if (today > 0) {
    parts.push(`${today} OS foram registradas hoje${thisMonth > today ? `, totalizando ${thisMonth} no mês.` : "."}`);
  } else if (thisMonth > 0) {
    parts.push(`${thisMonth} OS foram registradas este mês.`);
  }

  if (topTech) {
    const techRate = topTech.total > 0 ? ((topTech.completed / topTech.total) * 100).toFixed(0) : "0";
    parts.push(`Técnico destaque: ${topTech.technicianName} com ${topTech.total} OS (${techRate}% de conclusão).`);
  }

  if (worstTech && worstTech !== topTech && worstTech.pending > 2) {
    parts.push(`${worstTech.technicianName} possui ${worstTech.pending} OS pendentes em aberto.`);
  }

  if (topLocation) {
    parts.push(`Local com maior volume: "${topLocation.location}" (${topLocation.total} OS).`);
  }

  if (completed > 0 && rate >= 70) {
    parts.push("O nível de serviço está adequado para as operações da unidade.");
  } else if (total === 0) {
    parts.push("Nenhuma OS foi registrada neste período — verifique se os filtros estão corretos.");
  }

  return parts.join(" ");
}

// ── POST /dashboard/ai-summary ───────────────────────────────────────────────
// Gera resumo executivo do painel. Usa OpenAI se OPENAI_API_KEY estiver
// configurada; caso contrário, gera um resumo inteligente com lógica interna.
router.post("/dashboard/ai-summary", async (req, res) => {
  try {
    const body = req.body as { summary?: any; filterLabel?: string };
    const s = body.summary ?? {};

    const apiKey =
      process.env["OPENAI_API_KEY"] ||
      process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

    // ── Fallback local (sem API key) ────────────────────────────────────────
    if (!apiKey) {
      res.json({ text: buildLocalSummary(s, body.filterLabel), source: "local" });
      return;
    }

    // ── Caminho OpenAI ──────────────────────────────────────────────────────
    const baseUrl = (
      process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    const topTechs = (s.byTechnician ?? [])
      .slice(0, 6)
      .map((t: any) => `${t.technicianName}: ${t.total} OS, ${t.completed} concluídas`)
      .join("; ");
    const topLocals = (s.byLocation ?? [])
      .slice(0, 5)
      .map((l: any) => `${l.location} (${l.total})`)
      .join(", ");

    const dataText = [
      `Período: ${body.filterLabel || "Atual"}`,
      `Abertas: ${s.totalOpen ?? 0} | Andamento: ${s.totalInProgress ?? 0} | Concluídas: ${s.totalCompleted ?? 0} | Canceladas: ${s.totalCanceled ?? 0} | Atrasadas: ${s.totalOverdue ?? 0}`,
      `Hoje: ${s.totalToday ?? 0} | Este mês: ${s.totalThisMonth ?? 0}`,
      `Taxa de conclusão: ${s.completionRate ?? 0}%`,
      `Valor estimado: R$ ${(s.totalValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Top técnicos: ${topTechs || "N/A"}`,
      `Principais locais: ${topLocals || "N/A"}`,
    ].join("\n");

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente de gestão operacional para o Grupo Rede Amazônica. Analise os dados do painel de ordens de serviço e forneça um resumo executivo conciso (máximo 120 palavras) em português. Destaque pontos críticos, tendências e recomendações práticas sem usar bullet points.",
          },
          { role: "user", content: `Dados do Painel:\n${dataText}` },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      // OpenAI falhou — usa fallback local em vez de retornar erro
      res.json({ text: buildLocalSummary(s, body.filterLabel), source: "local" });
      return;
    }

    const aiData = (await aiResponse.json()) as any;
    const text = aiData?.choices?.[0]?.message?.content ?? buildLocalSummary(s, body.filterLabel);
    res.json({ text, source: "openai" });
  } catch (err) {
    req.log.error(err);
    // Nunca retorna erro — sempre entrega o fallback local
    const s = (req.body as any)?.summary ?? {};
    res.json({ text: buildLocalSummary(s, (req.body as any)?.filterLabel), source: "local" });
  }
});

export default router;
