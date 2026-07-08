import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SheetGrid } from "@/components/compras/sheet-grid";
import type { Workbook } from "@/types/purchase-sheet";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"];

type SheetResponse = { unidade: string; data: Workbook; updatedAt: string };

export default function ComprasServicosPublico() {
  const params = useParams<{ unidade: string }>();
  const unidade = (params.unidade || "").toUpperCase();
  const [activeTabId, setActiveTabId] = useState("");

  const validUnit = UNITS.includes(unidade);
  const { data, isLoading } = useQuery<SheetResponse>({
    queryKey: ["purchase-sheet-publico", unidade],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/purchase-sheets?unidade=${unidade}`);
      if (!res.ok) throw new Error("Erro ao carregar planilha");
      return res.json();
    },
    enabled: validUnit,
  });

  const workbook = data?.data;
  const currentTabId = activeTabId || workbook?.tabs[0]?.id || "";

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Compras e Serviços {validUnit ? `— Unidade ${unidade}` : ""}</div>
        </div>
      </header>

      <div className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Compras e Serviços
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Consulta pública — somente leitura.</p>
          </div>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              {!validUnit ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Unidade inválida.</div>
              ) : isLoading || !workbook ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : (
                <SheetGrid workbook={workbook} activeTabId={currentTabId} onActiveTabChange={setActiveTabId} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
