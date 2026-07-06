import { Router } from "express";
import { db } from "@workspace/db";
import { linksTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/links", async (req, res) => {
  try {
    const unidade = req.query.unidade as string | undefined;
    const conditions: any[] = [];
    if (unidade) conditions.push(eq(linksTable.unidade, unidade));
    const rows = await db
      .select()
      .from(linksTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${linksTable.createdAt} DESC`);
    res.json(rows.map(formatLink));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/links", async (req, res) => {
  try {
    const { unidade, nome, descricao, url } = req.body;
    if (!nome || !url) {
      res.status(400).json({ error: "Nome e URL são obrigatórios" });
      return;
    }
    const [created] = await db
      .insert(linksTable)
      .values({
        unidade: unidade || "AM",
        nome,
        descricao: descricao ?? null,
        url,
      })
      .returning();
    res.status(201).json(formatLink(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/links/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { unidade, nome, descricao, url } = req.body;
    const conditions: any[] = [eq(linksTable.id, id)];
    if (unidade) conditions.push(eq(linksTable.unidade, unidade));
    const [updated] = await db
      .update(linksTable)
      .set({
        ...(nome !== undefined && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(url !== undefined && { url }),
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    if (!updated) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(formatLink(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/links/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const unidade = req.query.unidade as string | undefined;
    const conditions: any[] = [eq(linksTable.id, id)];
    if (unidade) conditions.push(eq(linksTable.unidade, unidade));
    await db.delete(linksTable).where(and(...conditions));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

function formatLink(l: any) {
  return {
    ...l,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    updatedAt: l.updatedAt instanceof Date ? l.updatedAt.toISOString() : l.updatedAt,
  };
}

export default router;
