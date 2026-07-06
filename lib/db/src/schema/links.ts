import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const linksTable = pgTable("links", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default("AM"),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Link = typeof linksTable.$inferSelect;
export type InsertLink = typeof linksTable.$inferInsert;
