import { Router } from "express";
import { db } from "@workspace/db";
import { materialWithdrawalsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { resolveUnit } from "../lib/share-tokens";
import { requireSystemActive } from "../lib/system-guard";

const router = Router();

router.get("/material-withdrawals", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const conditions: any[] = [];
    if (unidade) conditions.push(eq(materialWithdrawalsTable.unidade, unidade));
    const rows = await db
      .select()
      .from(materialWithdrawalsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${materialWithdrawalsTable.createdAt} DESC`);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/material-withdrawals", requireSystemActive, async (req, res) => {
  try {
    const {
      nome,
      date,
      tipoMaterial,
      quantidade,
      justificativa,
      foto,
      tipo,
      unidade,
    } = req.body;
    if (!date || !tipoMaterial || !quantidade || !justificativa || !tipo) {
      res.status(400).json({ error: "Campos obrigatórios faltando" });
      return;
    }
    const [created] = await db
      .insert(materialWithdrawalsTable)
      .values({
        nome: nome || "",
        date,
        tipoMaterial,
        quantidade,
        justificativa,
        foto: foto ?? null,
        tipo,
        unidade: unidade || "AM",
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/material-withdrawals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, date, tipoMaterial, quantidade, justificativa, foto, tipo } =
      req.body;
    const [updated] = await db
      .update(materialWithdrawalsTable)
      .set({
        ...(nome !== undefined && { nome }),
        ...(date !== undefined && { date }),
        ...(tipoMaterial !== undefined && { tipoMaterial }),
        ...(quantidade !== undefined && { quantidade }),
        ...(justificativa !== undefined && { justificativa }),
        ...(foto !== undefined && { foto }),
        ...(tipo !== undefined && { tipo }),
        updatedAt: new Date(),
      })
      .where(eq(materialWithdrawalsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Não encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/material-withdrawals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(materialWithdrawalsTable)
      .where(eq(materialWithdrawalsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
