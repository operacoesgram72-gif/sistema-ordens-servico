import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados nos Secrets."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Salva uma ordem de serviço na tabela "ordens_de_servico" no Supabase.
 *
 * @param {Object} dados
 * @param {string} dados.eu_ia        - Identificador da IA que gerou o registro
 * @param {string} dados.numero       - Número da OS
 * @param {string} dados.titulo       - Título da OS
 * @param {string} dados.descricao    - Descrição da OS
 * @param {string} dados.categoria    - Categoria da OS
 * @param {string} dados.prioridade   - Prioridade (ex: "alta", "media", "baixa")
 * @param {string} dados.status       - Status (ex: "aberta", "concluida")
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function salvarNoSupabase(dados) {
  const { eu_ia, numero, titulo, descricao, categoria, prioridade, status } = dados;

  const { data, error } = await supabase
    .from("ordens_de_servico")
    .insert([{ eu_ia, numero, titulo, descricao, categoria, prioridade, status }])
    .select();

  if (error) {
    console.error("Erro ao salvar no Supabase:", error.message);
  } else {
    console.log("Salvo com sucesso:", data);
  }

  return { data, error };
}
