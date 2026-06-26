import { pgTable, serial, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceOrdersTable = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("media"),
  status: text("status").notNull().default("aberta"),
  location: text("location").notNull(),
  department: text("department"),
  technicianId: integer("technician_id"),
  technicianNameFree: text("technician_name_free"),
  notes: text("notes"),
  tipo: text("tipo"),
  formatoServico: text("formato_servico"),
  photos: text("photos"),
  signature: text("signature"),
  signedBy: text("signed_by"),
  signedAt: timestamp("signed_at"),
  estimatedValue: numeric("estimated_value"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  unidade: text("unidade").notNull().default("AM"),
  origem: text("origem").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrdersTable).omit({
  id: true,
  number: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrder = typeof serviceOrdersTable.$inferSelect;
