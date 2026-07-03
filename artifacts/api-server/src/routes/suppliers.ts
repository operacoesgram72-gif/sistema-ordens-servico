import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { CreateSupplierBody, UpdateSupplierBody } from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /suppliers
router.get("/suppliers", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(suppliersTable)
      .orderBy(sql`${suppliersTable.razaoSocial} ASC NULLS LAST`);
    res.json(rows.map(formatSupplier));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /suppliers/:id (public read-only lookup, used by supplier share links)
router.get("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
    if (!row) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(formatSupplier(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /suppliers
router.post("/suppliers", async (req, res) => {
  try {
    const body = CreateSupplierBody.parse(req.body);
    const [created] = await db
      .insert(suppliersTable)
      .values({
        cnpjCpf: body.cnpjCpf ?? null,
        razaoSocial: body.razaoSocial ?? null,
        endereco: body.endereco ?? null,
        uf: body.uf ?? null,
        cidade: body.cidade ?? null,
        contato: body.contato ?? null,
        email: body.email ?? null,
        atendente: body.atendente ?? null,
        localizacaoLink: body.localizacaoLink ?? null,
      })
      .returning();
    res.status(201).json(formatSupplier(created));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// PATCH /suppliers/:id
router.patch("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateSupplierBody.parse(req.body);
    const [updated] = await db
      .update(suppliersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(suppliersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(formatSupplier(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

// DELETE /suppliers/:id
router.delete("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

function formatSupplier(s: any) {
  return {
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

export default router;
