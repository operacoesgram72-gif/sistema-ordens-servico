import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/**
 * GET /search?q=texto&unidade=AM
 * Pesquisa global através de OS, fornecedores, técnicos e materiais.
 * Retorna até 20 resultados ordenados por relevância/data.
 */
router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const unidade = String(req.query.unidade ?? "AM");

  if (q.length < 2) {
    res.json([]);
    return;
  }

  const like = `%${q}%`;

  try {
    const [os, suppliers, techs, materials] = await Promise.all([
      db.execute(sql`
        SELECT
          id,
          'os' AS type,
          number AS title,
          COALESCE(location, LEFT(description, 60)) AS subtitle,
          status,
          unidade
        FROM service_orders
        WHERE unidade = ${unidade}
          AND (
            number ILIKE ${like}
            OR location ILIKE ${like}
            OR COALESCE(technician_name_free, technician_name) ILIKE ${like}
            OR description ILIKE ${like}
          )
        ORDER BY created_at DESC
        LIMIT 5
      `),

      db.execute(sql`
        SELECT
          id,
          'supplier' AS type,
          COALESCE(razao_social, cnpj_cpf, 'Fornecedor') AS title,
          COALESCE(cidade, contato) AS subtitle,
          NULL AS status,
          unidade
        FROM suppliers
        WHERE unidade = ${unidade}
          AND (
            razao_social ILIKE ${like}
            OR cnpj_cpf ILIKE ${like}
            OR cidade ILIKE ${like}
            OR contato ILIKE ${like}
            OR atendente ILIKE ${like}
          )
        LIMIT 5
      `),

      db.execute(sql`
        SELECT
          id,
          'tech' AS type,
          name AS title,
          COALESCE(specialty, position) AS subtitle,
          NULL AS status,
          unidade
        FROM technicians
        WHERE (unidade = ${unidade} OR is_corporate = true)
          AND active = true
          AND (name ILIKE ${like} OR specialty ILIKE ${like} OR position ILIKE ${like})
        LIMIT 5
      `),

      db.execute(sql`
        SELECT
          id,
          'material' AS type,
          nome AS title,
          tipo AS subtitle,
          NULL AS status,
          unidade
        FROM material_withdrawals
        WHERE unidade = ${unidade}
          AND (nome ILIKE ${like} OR tipo ILIKE ${like})
        ORDER BY created_at DESC
        LIMIT 5
      `),
    ]);

    res.json([
      ...os.rows,
      ...suppliers.rows,
      ...techs.rows,
      ...materials.rows,
    ]);
  } catch (err) {
    req.log.error(err, "search error");
    res.json([]); // never 500 — degrade gracefully
  }
});

export default router;
