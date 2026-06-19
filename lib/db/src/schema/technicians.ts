import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const techniciansTable = pgTable("technicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  phone: text("phone"),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTechnicianSchema = createInsertSchema(techniciansTable).omit({ id: true, createdAt: true });
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof techniciansTable.$inferSelect;
