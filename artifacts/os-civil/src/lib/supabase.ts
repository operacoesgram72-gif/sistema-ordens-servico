const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function post(table: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function salvarNovaOS(data: Record<string, unknown>): void {
  post(
    "service_orders",
    {
      number: data.number,
      title: data.title,
      description: data.description ?? null,
      category: data.category,
      priority: data.priority ?? "media",
      status: data.status ?? "aberta",
      location: data.location,
      tipo: data.tipo ?? null,
      formato_servico: data.formatoServico ?? null,
      technician_name_free: data.technicianName ?? null,
      photos: data.photos ?? null,
      unidade: data.unidade ?? "AM",
      origem: data.origem ?? "manual",
      scheduled_at: data.scheduledAt ?? null,
    },
    { "Prefer": "resolution=ignore-duplicates,return=minimal" }
  );
}

export function salvarRetiradaMateriais(form: Record<string, unknown>): void {
  post("material_withdrawals", {
    unidade: form.unidade ?? "AM",
    date: form.date,
    tipo_material: form.tipoMaterial,
    quantidade: form.quantidade,
    justificativa: form.justificativa,
    foto: form.foto ?? null,
    tipo: "retirada",
  });
}

export function salvarArquivo(entry: {
  unidade: string;
  parentId?: number | null;
  name: string;
  isFolder: number;
  fileType?: string;
  fileSize?: number;
}): void {
  post("uploaded_files", {
    unidade: entry.unidade,
    parent_id: entry.parentId ?? null,
    name: entry.name,
    is_folder: entry.isFolder,
    file_type: entry.fileType ?? null,
    file_size: entry.fileSize ?? null,
  });
}

export function salvarPmoc(storageKey: string, rows: unknown[]): void {
  const unidade = storageKey.split(":")[0] ?? null;
  post("pmoc_bebedouros", {
    storage_key: storageKey,
    unidade,
    rows: rows as Record<string, unknown>[],
  });
}
