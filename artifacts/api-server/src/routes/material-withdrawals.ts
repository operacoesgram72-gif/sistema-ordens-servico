import { Router } from "express";
import { db } from "@workspace/db";
import { materialWithdrawalsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { resolveUnit } from "../lib/share-tokens";
import { requireSystemActive } from "../lib/system-guard";

const router = Router();

// ── Columns for the list view ────────────────────────────────────────────────
// `foto` is intentionally excluded here — it stores base64-encoded image data
// (sometimes several photos per row) which can reach hundreds of KB per record.
// Loading it for every row makes the list slow to open and grows worse as the
// table fills up. `hasFoto` is a lightweight boolean so the UI can still show a
// photo indicator; the actual image bytes are fetched on demand via
// GET /material-withdrawals/:id when the user opens the lightbox.
const LIST_COLUMNS = {
  id:             materialWithdrawalsTable.id,
  unidade:        materialWithdrawalsTable.unidade,
  nome:           materialWithdrawalsTable.nome,
  date:           materialWithdrawalsTable.date,
  tipoMaterial:   materialWithdrawalsTable.tipoMaterial,
  quantidade:     materialWithdrawalsTable.quantidade,
  justificativa:  materialWithdrawalsTable.justificativa,
  tipo:           materialWithdrawalsTable.tipo,
  createdAt:      materialWithdrawalsTable.createdAt,
  updatedAt:      materialWithdrawalsTable.updatedAt,
  hasFoto:        sql<boolean>`(foto IS NOT NULL AND foto NOT IN ('[]', 'null', ''))`.as("has_foto"),
} as const;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

router.get("/material-withdrawals", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined);
    const conditions: any[] = [];
    if (unidade) conditions.push(eq(materialWithdrawalsTable.unidade, unidade));

    // Bounded, paginated fetch so the list stays fast as records accumulate.
    // Defaults preserve current behavior (most recent records first) while
    // giving the frontend a "carregar mais" hook for large datasets.
    const limitParam = Number(req.query.limit);
    const offsetParam = Number(req.query.offset);
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

    const rows = await db
      .select(LIST_COLUMNS)
      .from(materialWithdrawalsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${materialWithdrawalsTable.createdAt} DESC`)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    res.json({ records: rows.slice(0, limit), hasMore });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Full record (including `foto` base64 payload) — fetched on demand when the
// user opens the photo lightbox for a specific row, keeping the list endpoint
// light.
router.get("/material-withdrawals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(materialWithdrawalsTable)
      .where(eq(materialWithdrawalsTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Não encontrado" });
      return;
    }
    res.json(row);
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
