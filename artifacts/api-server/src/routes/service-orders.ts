import { Router } from "express";
import { db } from "@workspace/db";
import { serviceOrdersTable, techniciansTable } from "@workspace/db";
import {
  CreateServiceOrderBody,
  UpdateServiceOrderBody,
  UpdateServiceOrderStatusBody,
  SignServiceOrderBody,
  ListServiceOrdersQueryParams,
} from "@workspace/api-zod";
import { eq, and, gte, lte, like, or, sql } from "drizzle-orm";
import { sendOsNotification } from "./settings";

const router = Router();

// Market value reference per formato_servico (R$/service average)
const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  outros: 180,
};

function generateNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `OS-${year}-${rand}`;
}

function parseDate(val: unknown): Date | undefined {
  if (!val || typeof val !== "string") return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

async function enrichWithTechnician(orders: any[]) {
  if (!orders.length) return orders;
  const techs = await db.select().from(techniciansTable);
  const techMap = new Map(techs.map((t) => [t.id, t.name]));
  return orders.map((o) => ({
    ...o,
    technicianName: o.technicianNameFree
      ? o.technicianNameFree
      : o.technicianId ? techMap.get(o.technicianId) ?? null : null,
    scheduledAt: o.scheduledAt ? o.scheduledAt.toISOString() : null,
    completedAt: o.completedAt ? o.completedAt.toISOString() : null,
    signedAt: o.signedAt ? o.signedAt.toISOString() : null,
    estimatedValue: o.estimatedValue !== null && o.estimatedValue !== undefined
      ? Number(o.estimatedValue)
      : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));
}

// GET /service-orders
router.get("/service-orders", async (req, res) => {
  try {
    const parsed = ListServiceOrdersQueryParams.safeParse(req.query);
    const q = parsed.success ? parsed.data : (req.query as any);

    const conditions: any[] = [];

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

    const rows = await db
      .select()
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

// POST /service-orders
router.post("/service-orders", async (req, res) => {
  try {
    const body = CreateServiceOrderBody.parse(req.body);
    const number = generateNumber();

    // Always auto-calculate estimated value from formato_servico market rates
    const estimatedValue = body.formatoServico
      ? MARKET_RATES[body.formatoServico] ?? null
      : null;

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
        status: "aberta",
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
      technicianName: (enriched as any).technicianName ?? null,
      formatoServico: created.formatoServico ?? null,
      estimatedValue: created.estimatedValue ? Number(created.estimatedValue) : null,
    }).catch(() => {}); // already handled internally
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
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
    if (!row) return res.status(404).json({ error: "Não encontrada" });
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

    if (!updated) return res.status(404).json({ error: "Não encontrada" });
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

    if (!updated) return res.status(404).json({ error: "Não encontrada" });
    const [enriched] = await enrichWithTechnician([updated]);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
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

    if (!updated) return res.status(404).json({ error: "Não encontrada" });
    const [enriched] = await enrichWithTechnician([updated]);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

export default router;
