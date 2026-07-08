import { Router } from "express";
import { db } from "@workspace/db";
import { purchaseSheetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveUnit } from "../lib/share-tokens";

const router = Router();

const UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"];

type SheetTab = { id: string; name: string; columns: string[]; rows: string[][] };
type Workbook = { tabs: SheetTab[] };

// Default starter workbook seeded for a unit's first access — a single tab
// mirroring the columns of the reference purchasing/requisition sheet.
// Fully editable: the AM/unit admin can rename this tab, add more tabs, and
// add/remove columns and rows to match their own spreadsheet exactly.
function defaultWorkbook(): Workbook {
  const columns = [
    "Código", "Data", "Descrição", "Fornecedor", "Valor Total", "Status",
    "Aguardando Aprovação", "Solicitante", "Mês", "Nº Pedido", "Classificação", "Observação",
  ];
  return {
    tabs: [
      {
        id: "solicitacoes",
        name: "Solicitações",
        columns,
        rows: Array.from({ length: 8 }, () => Array(columns.length).fill("")),
      },
    ],
  };
}

function isValidWorkbook(data: any): data is Workbook {
  if (!data || typeof data !== "object" || !Array.isArray(data.tabs)) return false;
  return data.tabs.every((t: any) =>
    t && typeof t.id === "string" && typeof t.name === "string" &&
    Array.isArray(t.columns) && t.columns.every((c: any) => typeof c === "string") &&
    Array.isArray(t.rows) && t.rows.every((r: any) => Array.isArray(r) && r.every((c: any) => typeof c === "string"))
  );
}

// GET /purchase-sheets?unidade=AM — fetches (auto-creating a default workbook
// on first access) the sheet for the given unit. Used by both the admin
// editable view and the read-only public share link.
router.get("/purchase-sheets", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined) || "AM";
    if (!UNITS.includes(unidade)) {
      res.status(400).json({ error: "Unidade inválida." });
      return;
    }
    const [existing] = await db.select().from(purchaseSheetsTable).where(eq(purchaseSheetsTable.unidade, unidade));
    if (existing) {
      res.json({ unidade, data: existing.data, updatedAt: existing.updatedAt });
      return;
    }
    const [created] = await db
      .insert(purchaseSheetsTable)
      .values({ unidade, data: defaultWorkbook() })
      .returning();
    res.json({ unidade, data: created.data, updatedAt: created.updatedAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /purchase-sheets?unidade=AM — persists the full workbook (autosaved from the frontend).
router.put("/purchase-sheets", async (req, res) => {
  try {
    const unidade = resolveUnit(req, req.query.unidade as string | undefined) || "AM";
    if (!UNITS.includes(unidade)) {
      res.status(400).json({ error: "Unidade inválida." });
      return;
    }
    const { data } = req.body as { data?: unknown };
    if (!isValidWorkbook(data)) {
      res.status(400).json({ error: "Dados da planilha inválidos." });
      return;
    }
    const [existing] = await db.select().from(purchaseSheetsTable).where(eq(purchaseSheetsTable.unidade, unidade));
    let saved;
    if (existing) {
      [saved] = await db
        .update(purchaseSheetsTable)
        .set({ data, updatedAt: new Date() })
        .where(eq(purchaseSheetsTable.unidade, unidade))
        .returning();
    } else {
      [saved] = await db
        .insert(purchaseSheetsTable)
        .values({ unidade, data })
        .returning();
    }
    res.json({ unidade, data: saved.data, updatedAt: saved.updatedAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
