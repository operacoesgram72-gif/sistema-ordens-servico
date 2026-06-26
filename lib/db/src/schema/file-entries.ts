import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const fileEntriesTable = pgTable("file_entries", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default("AM"),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  isFolder: integer("is_folder").notNull().default(0),
  fileData: text("file_data"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FileEntry = typeof fileEntriesTable.$inferSelect;
export type InsertFileEntry = typeof fileEntriesTable.$inferInsert;
