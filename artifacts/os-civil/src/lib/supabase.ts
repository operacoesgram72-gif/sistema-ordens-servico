const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface OrdemDeServico {
  formulario: string;
  dados: Record<string, unknown>;
  criado_em?: string;
}

export function salvarOrdemDeServico(payload: OrdemDeServico): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const body = JSON.stringify({ ...payload, criado_em: new Date().toISOString() });

  fetch(`${SUPABASE_URL}/rest/v1/ordens_de_servico`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal",
    },
    body,
  }).catch(() => {});
}
