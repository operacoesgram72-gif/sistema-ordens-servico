import { Router } from "express";
import { db } from "@workspace/db";
import { contactsTable } from "@workspace/db";
import { CreateContactBody, UpdateContactBody } from "@workspace/api-zod";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// GET /contacts
router.get("/contacts", async (req, res) => {
  try {
    const unidade = req.query.unidade as string | undefined;
    const conditions: any[] = [];
    if (unidade) conditions.push(eq(contactsTable.unidade, unidade));
    const rows = await db
      .select()
      .from(contactsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${contactsTable.name} ASC`);
    res.json(rows.map(formatContact));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /contacts
router.post("/contacts", async (req, res) => {
  try {
    const body = CreateContactBody.parse(req.body);
    const unidade = (req.body.unidade as string) || "AM";
    const [created] = await db
      .insert(contactsTable)
      .values({
        unidade,
        name: body.name,
        cpf: body.cpf ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        birthDate: body.birthDate ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    res.status(201).json(formatContact(created));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// PATCH /contacts/:id
router.patch("/contacts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateContactBody.parse(req.body);
    const [updated] = await db
      .update(contactsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(formatContact(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// DELETE /contacts/:id
router.delete("/contacts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(contactsTable).where(eq(contactsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

function formatContact(c: any) {
  return {
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

export default router;
