const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function salvarOrdemDeServico(dados) {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `
      INSERT INTO service_orders (number, title, description, category, priority, status, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        dados.number,
        dados.title,
        dados.description,
        dados.category || "Sem categoria",
        dados.priority || "média",
        dados.status || "pendente",
        dados.location || "Não informado",
      ],
    );

    console.log("✅ SUCESSO! Ordem salva no Supabase. ID:", result.rows[0].id);
    client.release();
    return result.rows[0];
  } catch (error) {
    console.error("❌ Erro ao salvar:", error.message);
    return null;
  }
}

module.exports = { salvarOrdemDeServico };
