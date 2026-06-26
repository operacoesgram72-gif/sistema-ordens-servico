import { useLocation, useSearch } from "wouter";
import { ArrowLeft, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UNITS, type Unit } from "@/contexts/unit-context";
import Pmoc from "./pmoc";

export default function RegistrarPmoc() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const unitFromUrl = (params.get("u") || "AM") as Unit;
  const unitInfo = UNITS.find(u => u.key === unitFromUrl) || UNITS[0];
  const [, setLocation] = useLocation();

  const goBack = () => setTimeout(() => setLocation(`/registrar?u=${unitFromUrl}`), 0);

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img
          src="/logo-amazonica.png"
          alt="Logo Rede Amazônica"
          className="h-10 w-10 object-contain"
        />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Departamento: Operações</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <Badge variant="outline" className="font-mono text-primary border-primary/50 text-xs px-2">
              {unitFromUrl}
            </Badge>
            <span className="hidden sm:inline text-muted-foreground/60">— {unitInfo.name}</span>
          </div>
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Menu
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <Pmoc />
      </div>
    </div>
  );
}
