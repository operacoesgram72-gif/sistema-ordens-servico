import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default("AM"),
  cnpjCpf: text("cnpj_cpf"),
  razaoSocial: text("razao_social"),
  endereco: text("endereco"),
  uf: text("uf"),
  cidade: text("cidade"),
  contato: text("contato"),
  email: text("email"),
  atendente: text("atendente"),
  localizacaoLink: text("localizacao_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Supplier = typeof suppliersTable.$inferSelect;
export type InsertSupplier = typeof suppliersTable.$inferInsert;
