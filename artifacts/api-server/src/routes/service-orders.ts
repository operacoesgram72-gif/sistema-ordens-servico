import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { serviceOrdersTable, techniciansTable } from "@workspace/db";
import { resolveUnit } from "../lib/share-tokens";
import { requireSystemActive } from "../lib/system-guard";
import {
  CreateServiceOrderBody,
  UpdateServiceOrderBody,
  UpdateServiceOrderStatusBody,
  SignServiceOrderBody,
  ListServiceOrdersQueryParams,
} from "@workspace/api-zod";
import { eq, and, gte, lte, like, or, sql, inArray } from "drizzle-orm";
import { sendOsNotification } from "./settings";
import { broadcast } from "../lib/sse-broadcast";

const router = Router();

// Market value reference per formato_servico (R$/service average)
const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  ronda: 120,
  outros: 180,
};

function generateNumber(): string {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `OS-${rand}`;
}

function parseDate(val: unknown): Date | undefined {
  if (!val || typeof val !== "string") return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Columns to select for the list view ──────────────────────────────────────
// Explicitly exclude `photos` and `signature` — those fields contain base64
// image data that can be hundreds of KB per row. Returning them for every OS in
// a list makes the response balloon to tens of MBs, causing the browser to hang
// and the server to hit memory limits. The detail endpoint (/service-orders/:id)
// still returns every column.
const LIST_COLUMNS = {
  id:               serviceOrdersTable.id,
  number:           serviceOrdersTable.number,
  title:            serviceOrdersTable.title,
  description:      serviceOrdersTable.description,
  category:         serviceOrdersTable.category,
  priority:         serviceOrdersTable.priority,
  status:           serviceOrdersTable.status,
  location:         serviceOrdersTable.location,
  department:       serviceOrdersTable.department,
  technicianId:     serviceOrdersTable.technicianId,
  technicianNameFree: serviceOrdersTable.technicianNameFree,
  notes:            serviceOrdersTable.notes,
  tipo:             serviceOrdersTable.tipo,
  formatoServico:   serviceOrdersTable.formatoServico,
  // photos and signature intentionally omitted from list — heavy base64 blobs
  // hasPhotos is a lightweight boolean so the list UI can show a camera indicator
  // without loading the actual base64 payload.
  hasPhotos:        sql<boolean>`(photos IS NOT NULL AND photos NOT IN ('[]', 'null', ''))`.as("has_photos"),
  signedBy:         serviceOrdersTable.signedBy,
  signedAt:         serviceOrdersTable.signedAt,
  estimatedValue:   serviceOrdersTable.estimatedValue,
  scheduledAt:      serviceOrdersTable.scheduledAt,
  completedAt:      serviceOrdersTable.completedAt,
  unidade:          serviceOrdersTable.unidade,
  origem:           serviceOrdersTable.origem,
  createdAt:        serviceOrdersTable.createdAt,
  updatedAt:        serviceOrdersTable.updatedAt,
} as const;

async function enrichWithTechnician(orders: any[]) {
  if (!orders.length) return orders;

  // Only fetch the specific technician IDs referenced — avoids a full table scan
  // on every request regardless of how many orders are in the list.
  const techIds = [...new Set(
    orders.map(o => o.technicianId).filter((id): id is number => id != null),
  )];
  const techMap = new Map<number, string>();
  if (techIds.length > 0) {
    const techs = await db
      .select({ id: techniciansTable.id, name: techniciansTable.name })
      .from(techniciansTable)
      .where(inArray(techniciansTable.id, techIds));
    techs.forEach(t => techMap.set(t.id, t.name));
  }

  return orders.map((o) => ({
    ...o,
    technicianName: o.technicianNameFree
      ? o.technicianNameFree
      : o.technicianId != null ? (techMap.get(o.technicianId) ?? null) : null,
    scheduledAt:    o.scheduledAt    ? o.scheduledAt.toISOString()    : null,
    completedAt:    o.completedAt    ? o.completedAt.toISOString()    : null,
    signedAt:       o.signedAt       ? o.signedAt.toISOString()       : null,
    estimatedValue: o.estimatedValue !== null && o.estimatedValue !== undefined
      ? Number(o.estimatedValue) : null,
    createdAt:  o.createdAt.toISOString(),
    updatedAt:  o.updatedAt.toISOString(),
  }));
}

// GET /service-orders
router.get("/service-orders", async (req, res) => {
  try {
    const parsed = ListServiceOrdersQueryParams.safeParse(req.query);
    const q = parsed.success ? parsed.data : (req.query as any);

    const conditions: any[] = [];

    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    if (unidade) conditions.push(eq(serviceOrdersTable.unidade, unidade));

    if (q.status) conditions.push(eq(serviceOrdersTable.status, q.status));
    if (q.category) conditions.push(eq(serviceOrdersTable.category, q.category));
    if (q.priority) conditions.push(eq(serviceOrdersTable.priority, q.priority));
    if (q.tipo) conditions.push(eq(serviceOrdersTable.tipo, q.tipo));
    if (q.formatoServico) conditions.push(eq(serviceOrdersTable.formatoServico, q.formatoServico));
    if (q.technicianId) conditions.push(eq(serviceOrdersTable.technicianId, Number(q.technicianId)));

    if (q.period === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      conditions.push(gte(serviceOrdersTable.createdAt, today));
      conditions.push(lte(serviceOrdersTable.createdAt, tomorrow));
    } else if (q.period === "monthly") {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(serviceOrdersTable.createdAt, start));
    } else if (q.period === "annual") {
      const start = new Date(new Date().getFullYear(), 0, 1);
      conditions.push(gte(serviceOrdersTable.createdAt, start));
    }

    if (q.dateFrom) {
      const d = parseDate(q.dateFrom);
      if (d) conditions.push(gte(serviceOrdersTable.createdAt, d));
    }
    if (q.dateTo) {
      const d = parseDate(q.dateTo);
      if (d) conditions.push(lte(serviceOrdersTable.createdAt, d));
    }

    if (q.search) {
      const term = `%${q.search}%`;
      conditions.push(
        or(
          like(serviceOrdersTable.title, term),
          like(serviceOrdersTable.number, term),
          like(serviceOrdersTable.location, term)
        )
      );
    }

    // Select only lightweight columns — photos/signature are excluded (see LIST_COLUMNS above).
    const rows = await db
      .select(LIST_COLUMNS)
      .from(serviceOrdersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${serviceOrdersTable.createdAt} DESC`);

    const enriched = await enrichWithTechnician(rows);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /service-orders — blocked when system is inactive
router.post("/service-orders", requireSystemActive, async (req, res) => {
  try {
    const unidade = (req.body.unidade as string) || "AM";
    const origem = (req.body.origem as string) || "manual";
    const body = CreateServiceOrderBody.parse(req.body);
    const number = generateNumber();

    // Calculate estimated value using tipo multiplier × base rate × 4 hours × IPCA 1.046
    const TIPO_MULT: Record<string, number> = {
      reforma: 1.5, revitalizacao: 1.2, preventiva: 0.8, corretiva: 1.0, outros: 1.0,
    };
    const baseRate = body.formatoServico ? (MARKET_RATES[body.formatoServico] ?? null) : null;
    const tipoMult = body.tipo ? (TIPO_MULT[body.tipo] ?? 1.0) : 1.0;
    const estimatedValue = baseRate !== null ? Math.round(baseRate * tipoMult * 4 * 1.046) : null;

    // Auto-generate title if not provided
    const title = body.title?.trim() || number;

    const [created] = await db
      .insert(serviceOrdersTable)
      .values({
        number,
        title,
        description: body.description ?? null,
        category: body.category,
        priority: body.priority,
        location: body.location,
        department: body.department ?? null,
        technicianNameFree: (body as any).technicianName ?? null,
        notes: body.notes ?? null,
        tipo: body.tipo ?? null,
        formatoServico: body.formatoServico ?? null,
        photos: body.photos ?? null,
        estimatedValue: estimatedValue !== null ? String(estimatedValue) : null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status: (body as any).status ?? "aberta",
        unidade,
        origem,
        // Pre-generate an opaque UUID share token at creation time.
        // This means the public link is only obtainable from the portal
        // (via the detail response), not mintable by arbitrary callers.
        shareToken: randomUUID(),
      })
      .returning();

    const [enriched] = await enrichWithTechnician([created]);
    res.status(201).json(enriched);

    // Fire email notification asynchronously (non-blocking)
    sendOsNotification({
      number: created.number,
      title: created.title,
      location: created.location,
      priority: created.priority,
      description: created.description ?? null,
      technicianName: (enriched as any).technicianName ?? null,
      formatoServico: created.formatoServico ?? null,
      estimatedValue: created.estimatedValue ? Number(created.estimatedValue) : null,
      photos: created.photos ?? null,
    }).catch(() => {}); // already handled internally
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// GET /service-orders/available-years — years that have at least one record
router.get("/service-orders/available-years", async (req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year FROM service_orders ORDER BY year DESC`
    );
    const years = (result.rows as any[])
      .map((r) => Number(r.year))
      .filter((y) => !isNaN(y));
    res.json(years.length ? years : [new Date().getFullYear()]);
  } catch (err) {
    req.log.error(err);
    res.json([new Date().getFullYear()]);
  }
});

// GET /service-orders/:id/photos — lightweight: returns only the photos field
// Used by the list page to lazy-load thumbnails without fetching the full OS payload.
router.get("/service-orders/:id/photos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select({ photos: serviceOrdersTable.photos })
      .from(serviceOrdersTable)
      .where(eq(serviceOrdersTable.id, id));
    if (!row) { res.status(404).json({ error: "Não encontrada" }); return; }
    res.json({ photos: row.photos ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /service-orders/:id
router.get("/service-orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(serviceOrdersTable)
      .where(eq(serviceOrdersTable.id, id));
    if (!row) { res.status(404).json({ error: "Não encontrada" }); return; }
    const [enriched] = await enrichWithTechnician([row]);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /service-orders/:id
router.patch("/service-orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateServiceOrderBody.parse(req.body);

    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);
    if (body.completedAt) updateData.completedAt = new Date(body.completedAt);
    // Map technicianName → technicianNameFree column
    if ((body as any).technicianName !== undefined) {
      updateData.technicianNameFree = (body as any).technicianName;
      delete updateData.technicianName;
    }
    // Remove fields not in DB columns
    delete updateData.estimatedValue;

    const [updated] = await db
      .update(serviceOrdersTable)
      .set(updateData)
      .where(eq(serviceOrdersTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Não encontrada" }); return; }
    const [enriched] = await enrichWithTechnician([updated]);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// DELETE /service-orders/:id
router.delete("/service-orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(serviceOrdersTable).where(eq(serviceOrdersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /service-orders/:id/status
router.patch("/service-orders/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateServiceOrderStatusBody.parse(req.body);

    const updateData: any = { status: body.status, updatedAt: new Date() };
    if (body.notes) updateData.notes = body.notes;
    if (body.status === "concluida") updateData.completedAt = new Date();

    const [updated] = await db
      .update(serviceOrdersTable)
      .set(updateData)
      .where(eq(serviceOrdersTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Não encontrada" }); return; }
    const [enriched] = await enrichWithTechnician([updated]);
    // Broadcast real-time event to all connected SSE clients
    broadcast({
      type: "status-changed",
      id: updated.id,
      number: updated.number,
      title: updated.title,
      status: updated.status,
      unidade: updated.unidade,
      updatedAt: updated.updatedAt.toISOString(),
    });
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// GET /shared-os/:token — public, unauthenticated read-only view of a single OS.
// Looks up by opaque UUID token only — no sequential ID is ever accepted.
// Returns an EXPLICIT allowlist of public fields; any new DB column is excluded
// by default unless deliberately added to PUBLIC_OS_FIELDS below.
const PUBLIC_OS_FIELDS = {
  number:           serviceOrdersTable.number,
  title:            serviceOrdersTable.title,
  description:      serviceOrdersTable.description,
  category:         serviceOrdersTable.category,
  priority:         serviceOrdersTable.priority,
  status:           serviceOrdersTable.status,
  location:         serviceOrdersTable.location,
  department:       serviceOrdersTable.department,
  technicianId:     serviceOrdersTable.technicianId,
  technicianNameFree: serviceOrdersTable.technicianNameFree,
  notes:            serviceOrdersTable.notes,
  tipo:             serviceOrdersTable.tipo,
  formatoServico:   serviceOrdersTable.formatoServico,
  photos:           serviceOrdersTable.photos,
  signature:        serviceOrdersTable.signature,
  signedBy:         serviceOrdersTable.signedBy,
  signedAt:         serviceOrdersTable.signedAt,
  estimatedValue:   serviceOrdersTable.estimatedValue,
  scheduledAt:      serviceOrdersTable.scheduledAt,
  completedAt:      serviceOrdersTable.completedAt,
  createdAt:        serviceOrdersTable.createdAt,
} as const;

router.get("/shared-os/:token", async (req, res) => {
  try {
    const { token } = req.params;
    // UUIDs are 36 chars (8-4-4-4-12 with hyphens). Reject obviously malformed tokens early.
    if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
      res.status(400).json({ error: "Token inválido" }); return;
    }

    const [row] = await db
      .select(PUBLIC_OS_FIELDS)
      .from(serviceOrdersTable)
      .where(eq(serviceOrdersTable.shareToken, token));
    if (!row) { res.status(404).json({ error: "Não encontrada" }); return; }

    // Resolve technician name independently — we cannot use enrichWithTechnician
    // here because that helper expects all date columns (including updatedAt) which
    // are intentionally excluded from the public projection.
    let technicianName: string | null = row.technicianNameFree ?? null;
    if (!technicianName && row.technicianId != null) {
      const [tech] = await db
        .select({ name: techniciansTable.name })
        .from(techniciansTable)
        .where(eq(techniciansTable.id, row.technicianId));
      technicianName = tech?.name ?? null;
    }

    // Strip the internal technicianId from the response — callers only need the name.
    const { technicianId: _tid, ...rest } = row;
    const safe = {
      ...rest,
      technicianName,
      scheduledAt:    row.scheduledAt?.toISOString()    ?? null,
      completedAt:    row.completedAt?.toISOString()    ?? null,
      signedAt:       row.signedAt?.toISOString()       ?? null,
      estimatedValue: row.estimatedValue !== null && row.estimatedValue !== undefined
        ? Number(row.estimatedValue) : null,
      createdAt:      row.createdAt.toISOString(),
    };
    res.json(safe);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /service-orders/:id/sign  — gestor assina e conclui a OS
router.post("/service-orders/:id/sign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = SignServiceOrderBody.parse(req.body);

    const now = new Date();
    const [updated] = await db
      .update(serviceOrdersTable)
      .set({
        status: "concluida",
        signedBy: body.signedBy,
        signature: body.signature ?? "assinado",
        signedAt: now,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(serviceOrdersTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Não encontrada" }); return; }
    const [enriched] = await enrichWithTechnician([updated]);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

export default router;
