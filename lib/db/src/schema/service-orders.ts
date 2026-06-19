import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceOrdersTable = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // manutencao, conservacao, limpeza, preventiva, construcao
  priority: text("priority").notNull().default("media"), // baixa, media, alta, urgente
  status: text("status").notNull().default("aberta"), // aberta, em_andamento, concluida, cancelada
  location: text("location").notNull(),
  technicianId: integer("technician_id"),
  notes: text("notes"),
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
