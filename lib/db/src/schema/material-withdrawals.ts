import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const materialWithdrawalsTable = pgTable("material_withdrawals", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default("AM"),
  nome: text("nome").notNull().default(""),
  date: text("date").notNull(),
  tipoMaterial: text("tipo_material").notNull(),
  quantidade: text("quantidade").notNull(),
  justificativa: text("justificativa").notNull(),
  foto: text("foto"),
  tipo: text("tipo").notNull().default("retirada"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MaterialWithdrawal = typeof materialWithdrawalsTable.$inferSelect;
export type InsertMaterialWithdrawal = typeof materialWithdrawalsTable.$inferInsert;
