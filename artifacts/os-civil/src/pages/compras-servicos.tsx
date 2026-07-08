import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Share2, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUnit } from "@/contexts/unit-context";
import { SheetGrid } from "@/components/compras/sheet-grid";
import type { Workbook } from "@/types/purchase-sheet";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type SheetResponse = { unidade: string; data: Workbook; updatedAt: string };

export default function ComprasServicos() {
  const { toast } = useToast();
  const { unit } = useUnit();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SheetResponse>({
    queryKey: ["purchase-sheet", unit],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/purchase-sheets?unidade=${unit}`);
      if (!res.ok) throw new Error("Erro ao carregar planilha");
      return res.json();
    },
  });

  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Load fresh data whenever the unit changes / initial fetch resolves.
  useEffect(() => {
    if (data) {
      setWorkbook(data.data);
      setActiveTabId(data.data.tabs[0]?.id ?? "");
      dirtyRef.current = false;
      setSaveState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, unit]);

  const persist = async (next: Workbook) => {
    setSaveState("saving");
    try {
      const res = await fetch(`${BASE_URL}/api/purchase-sheets?unidade=${unit}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: next }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["purchase-sheet", unit] });
    } catch {
      setSaveState("idle");
      toast({ title: "Erro ao salvar planilha", variant: "destructive" });
    }
  };

  const handleChange = (next: Workbook) => {
    setWorkbook(next);
    dirtyRef.current = true;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      dirtyRef.current = false;
      persist(next);
    }, 1200);
  };

  const handleManualSave = () => {
    if (!workbook) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    dirtyRef.current = false;
    persist(workbook);
  };

  const handleShare = () => {
    const url = `${window.location.origin}${BASE_URL}/compras/publico/${unit}`;
    if (navigator.share) {
      navigator.share({ title: `Compras e Serviços — ${unit}`, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copiado para a área de transferência!" });
    }).catch(() => {
      toast({ title: "Não foi possível copiar o link.", variant: "destructive" });
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />
            Compras e Serviços
          </h1>
          <p className="text-muted-foreground mt-1">Planilha da unidade <strong>{unit}</strong> — todas as células são editáveis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-[110px] justify-end">
            {saveState === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando…</>}
            {saveState === "saved" && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Salvo</>}
          </div>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
          <Button onClick={handleManualSave} disabled={!workbook || saveState === "saving"}>
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card border-border/50">
        {isLoading || !workbook ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando planilha...</div>
        ) : (
          <SheetGrid
            workbook={workbook}
            onChange={handleChange}
            activeTabId={activeTabId}
            onActiveTabChange={setActiveTabId}
          />
        )}
      </Card>
    </div>
  );
}
