import { Router } from "express";
import { db } from "@workspace/db";
import { techniciansTable } from "@workspace/db";
import { CreateTechnicianBody, UpdateTechnicianBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

// GET /technicians
router.get("/technicians", async (req, res) => {
  try {
    const rows = await db.select().from(techniciansTable).orderBy(techniciansTable.name);
    res.json(
      rows.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /technicians
router.post("/technicians", async (req, res) => {
  try {
    const body = CreateTechnicianBody.parse(req.body);
    const [created] = await db
      .insert(techniciansTable)
      .values({
        name: body.name,
        specialty: body.specialty,
        phone: body.phone ?? null,
        email: body.email ?? null,
      })
      .returning();

    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// PATCH /technicians/:id
router.patch("/technicians/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateTechnicianBody.parse(req.body);

    const [updated] = await db
      .update(techniciansTable)
      .set(body)
      .where(eq(techniciansTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Não encontrado" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// DELETE /technicians/:id
router.delete("/technicians/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(techniciansTable).where(eq(techniciansTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
