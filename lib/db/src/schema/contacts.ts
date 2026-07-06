import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default("AM"),
  name: text("name").notNull(),
  cpf: text("cpf"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  birthDate: date("birth_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = typeof contactsTable.$inferInsert;
