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
  notes: text("notes"),
  // New fields
  tipo: text("tipo"),                       // reforma, revitalizacao, preventiva, corretiva, outros
  formatoServico: text("formato_servico"),  // civil, refrigeracao, hidraulica, mecanica, outros
  photos: text("photos"),                   // JSON array of base64 strings
  signature: text("signature"),             // base64 signature image or text
  signedBy: text("signed_by"),
  signedAt: timestamp("signed_at"),
  estimatedValue: numeric("estimated_value"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
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
