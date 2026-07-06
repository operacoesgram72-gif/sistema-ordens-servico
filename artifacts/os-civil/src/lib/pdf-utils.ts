/**
 * PDF Utility — gera PDF profissional via janela de impressão.
 * Inclui logo, cabeçalho, data de emissão, tabela e rodapé.
 */

export interface PdfColumn {
  header: string;
  key: string;
  width?: string;
}

export interface PdfOptions {
  title: string;
  subtitle?: string;
  unit?: string;
  columns: PdfColumn[];
  rows: Record<string, string>[];
  logoUrl?: string;
}

export function generatePDF(options: PdfOptions): void {
  const { title, subtitle, unit, columns, rows, logoUrl } = options;
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const logo = logoUrl || `${window.location.origin}/logo-amazonica.png`;

  const tableHeaders = columns.map(c =>
    `<th style="padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; border-bottom: 2px solid #e5e7eb; white-space: nowrap; ${c.width ? `width: ${c.width};` : ""}">${c.header}</th>`
  ).join("");

  const tableRows = rows.map((row, i) => {
    const cells = columns.map(c =>
      `<td style="padding: 7px 10px; font-size: 12px; color: #1f2937; border-bottom: 1px solid #f3f4f6; vertical-align: top;">${row[c.key] ?? "—"}</td>`
    ).join("");
    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
    return `<tr style="background: ${bg};">${cells}</tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: white; color: #111827; padding: 24px; }
    @page { margin: 18mm 15mm; size: A4 landscape; }
    @media print { body { padding: 0; } .no-print { display: none; } }

    .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 18px; }
    .logo { width: 52px; height: 52px; object-fit: contain; }
    .company { flex: 1; }
    .company-name { font-size: 16px; font-weight: 700; color: #1d4ed8; }
    .company-dept { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .doc-info { text-align: right; font-size: 11px; color: #6b7280; }
    .doc-date { font-weight: 600; color: #374151; font-size: 12px; }

    .title-section { margin-bottom: 16px; }
    .title-section h1 { font-size: 18px; font-weight: 700; color: #111827; }
    .title-section .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .unit-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; margin-top: 4px; }

    .table-wrap { overflow-x: auto; border-radius: 6px; border: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #f1f5f9; }

    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    .total-badge { background: #f0fdf4; color: #166534; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 600; border: 1px solid #bbf7d0; margin-bottom: 12px; display: inline-block; }

    .print-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #1d4ed8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin-bottom: 16px; }
    .print-btn:hover { background: #1e40af; }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px;">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    <button style="margin-left: 8px; padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; cursor: pointer;" onclick="window.close()">✕ Fechar</button>
  </div>

  <div class="header">
    <img src="${logo}" alt="Logo" class="logo" onerror="this.style.display='none'" />
    <div class="company">
      <div class="company-name">Grupo Rede Amazônica</div>
      <div class="company-dept">Departamento: Operações · Painel de Serviços</div>
    </div>
    <div class="doc-info">
      <div class="doc-date">${dateStr}</div>
      <div>Emitido às ${timeStr}</div>
    </div>
  </div>

  <div class="title-section">
    <h1>${title}</h1>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    ${unit ? `<span class="unit-badge">Unidade: ${unit}</span>` : ""}
  </div>

  <div class="total-badge">Total de registros: ${rows.length}</div>

  <div class="table-wrap">
    <table>
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>${tableRows || '<tr><td colspan="' + columns.length + '" style="padding: 24px; text-align: center; color: #9ca3af;">Nenhum registro encontrado.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="footer">
    <span>Grupo Rede Amazônica — Sistema de Ordens de Serviço</span>
    <span>${dateStr} — ${timeStr}</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
