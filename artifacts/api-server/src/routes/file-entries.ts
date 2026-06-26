import { Router } from "express";
import { db } from "@workspace/db";
import { fileEntriesTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";

const router = Router();

router.get("/file-entries", async (req, res) => {
  try {
    const unidade = req.query.unidade as string | undefined;
    const parentIdParam = req.query.parentId as string | undefined;

    const conditions: any[] = [];
    if (unidade) conditions.push(eq(fileEntriesTable.unidade, unidade));
    if (parentIdParam === "root" || parentIdParam === undefined) {
      conditions.push(isNull(fileEntriesTable.parentId));
    } else {
      conditions.push(eq(fileEntriesTable.parentId, Number(parentIdParam)));
    }

    const entries = await db
      .select({
        id: fileEntriesTable.id,
        unidade: fileEntriesTable.unidade,
        parentId: fileEntriesTable.parentId,
        name: fileEntriesTable.name,
        isFolder: fileEntriesTable.isFolder,
        fileType: fileEntriesTable.fileType,
        fileSize: fileEntriesTable.fileSize,
        createdAt: fileEntriesTable.createdAt,
      })
      .from(fileEntriesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${fileEntriesTable.isFolder} DESC`, fileEntriesTable.name);

    res.json(entries);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/file-entries", async (req, res) => {
  try {
    const { unidade, parentId, name, isFolder, fileData, fileType, fileSize } = req.body;
    if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
    const [created] = await db
      .insert(fileEntriesTable)
      .values({
        unidade: unidade || "AM",
        parentId: parentId ?? null,
        name,
        isFolder: isFolder || 0,
        fileData: fileData ?? null,
        fileType: fileType ?? null,
        fileSize: fileSize ?? null,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/file-entries/:id/download", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [entry] = await db.select().from(fileEntriesTable).where(eq(fileEntriesTable.id, id));
    if (!entry || !entry.fileData) { res.status(404).json({ error: "Arquivo não encontrado" }); return; }
    const dataUrl = entry.fileData;
    const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64Data, "base64");
    res.set({
      "Content-Type": entry.fileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${entry.name}"`,
    });
    res.send(buffer);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/file-entries/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(fileEntriesTable).where(eq(fileEntriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
