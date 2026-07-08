import { pgTable, serial, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

// One row per unit (AM, AC, AP, RO, RR, PA). `data` holds the full workbook:
// { tabs: [{ id, name, columns, rows }] } — a fully generic, user-editable
// spreadsheet so each unit's "Compras e Serviços" sheet can be structured to
// mirror whatever tabs/columns the unit's own reference spreadsheet uses.
export const purchaseSheetsTable = pgTable(
  "purchase_sheets",
  {
    id: serial("id").primaryKey(),
    unidade: text("unidade").notNull(),
    data: jsonb("data").notNull().default({}),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    unidadeUnique: unique("purchase_sheets_unidade_unique").on(table.unidade),
  })
);

export type PurchaseSheet = typeof purchaseSheetsTable.$inferSelect;
export type InsertPurchaseSheet = typeof purchaseSheetsTable.$inferInsert;
