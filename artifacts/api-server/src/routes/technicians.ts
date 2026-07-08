import { Router } from "express";
import { db } from "@workspace/db";
import { techniciansTable } from "@workspace/db";
import { CreateTechnicianBody, UpdateTechnicianBody } from "@workspace/api-zod";
import { eq, or, and } from "drizzle-orm";
import { resolveUnit } from "../lib/share-tokens";

const router = Router();

// Only the AM unit may create/edit/delete technicians (org-chart structure,
// roles, managers, and positions are centrally administered from AM).
// Mirrors the requireAMUnit guard used for System Control in settings.ts.
function requireAMUnit(req: any, res: any, next: any) {
  const shareUnit: string | null = req.shareUnit ?? null;
  if (shareUnit && shareUnit !== "AM") {
    return res.status(403).json({ error: "Acesso restrito à unidade AM." });
  }
  next();
}

function formatTechnician(t: any) {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

async function validateManagerId(managerId: number | null | undefined, unidade: string) {
  if (managerId === null || managerId === undefined) return true;
  const [manager] = await db.select().from(techniciansTable).where(eq(techniciansTable.id, managerId));
  if (!manager) return false;
  // A manager must either be a shared corporate role or belong to the same unit.
  return manager.isCorporate || manager.unidade === unidade;
}

// Walks the manager chain upward from `startManagerId`; returns true if it
// ever reaches `technicianId`, which would create a cycle in the hierarchy.
async function wouldCreateCycle(technicianId: number, startManagerId: number | null): Promise<boolean> {
  let currentId = startManagerId;
  for (let hops = 0; currentId !== null && hops < 100; hops++) {
    if (currentId === technicianId) return true;
    const [node] = await db.select().from(techniciansTable).where(eq(techniciansTable.id, currentId));
    if (!node) return false;
    currentId = node.managerId;
  }
  return false;
}

// GET /technicians — scoped to the requesting unit; corporate (shared) roles
// are always included so every unit's org chart shows the same top of the tree.
router.get("/technicians", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const rows = await db
      .select()
      .from(techniciansTable)
      .where(unidade ? or(eq(techniciansTable.unidade, unidade), eq(techniciansTable.isCorporate, true)) : undefined)
      .orderBy(techniciansTable.name);
    res.json(rows.map(formatTechnician));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /technicians (AM-only)
router.post("/technicians", requireAMUnit, async (req, res) => {
  try {
    const body = CreateTechnicianBody.parse(req.body);
    const unidade = (req.body.unidade as string) || "AM";
    const managerId = body.managerId ?? null;

    if (!(await validateManagerId(managerId, unidade))) {
      res.status(400).json({ error: "Gestor inválido para esta unidade." });
      return;
    }
    // Note: a brand-new technician cannot be part of an existing cycle since
    // nothing can reference its id yet, so no cycle check is needed here.

    const [created] = await db
      .insert(techniciansTable)
      .values({
        name: body.name,
        specialty: body.specialty,
        phone: body.phone ?? null,
        email: body.email ?? null,
        unidade,
        position: body.position ?? null,
        managerId,
        photoUrl: body.photoUrl ?? null,
      })
      .returning();

    res.status(201).json(formatTechnician(created));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// PATCH /technicians/:id (AM-only)
router.patch("/technicians/:id", requireAMUnit, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateTechnicianBody.parse(req.body);

    const [existing] = await db.select().from(techniciansTable).where(eq(techniciansTable.id, id));
    if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }

    const nextUnidade = body.unidade ?? existing.unidade;
    // Validate against the *resulting* manager, even if this request only
    // changed `unidade` — otherwise switching units can silently leave a
    // technician pointing at a manager from their old unit.
    const nextManagerId = "managerId" in body ? body.managerId ?? null : existing.managerId ?? null;
    if (!(await validateManagerId(nextManagerId, nextUnidade))) {
      res.status(400).json({ error: "Gestor inválido para esta unidade." });
      return;
    }
    if (nextManagerId === id) {
      res.status(400).json({ error: "Um técnico não pode ser gestor de si mesmo." });
      return;
    }
    if (nextManagerId !== null && (await wouldCreateCycle(id, nextManagerId))) {
      res.status(400).json({ error: "Hierarquia inválida: gestor causaria um ciclo." });
      return;
    }

    const [updated] = await db
      .update(techniciansTable)
      .set(body)
      .where(eq(techniciansTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(formatTechnician(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// DELETE /technicians/:id (AM-only)
router.delete("/technicians/:id", requireAMUnit, async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Clear the manager reference on any direct reports so deleting a manager
    // doesn't leave dangling foreign keys or break the org-chart tree.
    await db.update(techniciansTable).set({ managerId: null }).where(eq(techniciansTable.managerId, id));
    await db.delete(techniciansTable).where(eq(techniciansTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
