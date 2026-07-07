import { useState } from "react";
import { Link, useSearch } from "wouter";
import { ClipboardList, Wind, PackageOpen, MapPin, LogIn, LogOut, ArrowLeft, PowerOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UNITS, type Unit } from "@/contexts/unit-context";
import { useSystemStatus } from "@/hooks/use-system-status";

export default function MenuFuncionario() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const unitFromUrl = (params.get("u") || "AM") as Unit;
  const unitInfo = UNITS.find(u => u.key === unitFromUrl) || UNITS[0];
  const [showOsSubMenu, setShowOsSubMenu] = useState(false);
  const { systemActive } = useSystemStatus();

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
            <span>Unidade</span>
            <Badge variant="outline" className="font-mono text-primary border-primary/50 text-xs px-2">
              {unitFromUrl}
            </Badge>
            <span className="hidden sm:inline text-muted-foreground/60">— {unitInfo.name}</span>
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest hidden md:inline">
            Painel de Serviços
          </span>
        </div>
      </header>

      {/* System inactive banner */}
      {!systemActive && (
        <div className="bg-red-900/80 text-red-200 text-xs font-semibold px-4 py-3 flex items-center justify-center gap-2 border-b border-red-700/50">
          <PowerOff className="w-3.5 h-3.5 shrink-0" />
          Sistema temporariamente indisponível — novos registros estão bloqueados por decisão administrativa
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">

          {/* OS Sub-menu */}
          {showOsSubMenu ? (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Ordem de Serviço</h1>
                <p className="text-muted-foreground text-sm">
                  Selecione a operação desejada.
                </p>
              </div>

              <div className="space-y-3">
                {/* Abrir OS */}
                <Link href={`/registrar/os?u=${unitFromUrl}`}>
                  <Card className="bg-card border-border/50 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all cursor-pointer group">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                        <LogIn className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-base leading-tight">Abrir OS</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Registrar uma nova Ordem de Serviço</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Fechar OS */}
                <Link href={`/registrar/fechar-os?u=${unitFromUrl}`}>
                  <Card className="bg-card border-border/50 hover:border-red-500/60 hover:bg-red-500/5 transition-all cursor-pointer group">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                        <LogOut className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-base leading-tight">Fechar OS</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Encerrar uma Ordem de Serviço existente</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Voltar */}
                <button
                  onClick={() => setShowOsSubMenu(false)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao menu principal
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Área do Funcionário</h1>
                <p className="text-muted-foreground text-sm">
                  Selecione uma das opções abaixo para continuar.
                </p>
              </div>

              <div className="space-y-3">
                {/* OS — mostra sub-menu */}
                <Card
                  className="bg-card border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                  onClick={() => setShowOsSubMenu(true)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <ClipboardList className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-base leading-tight">Ordem de Serviço</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Abrir ou fechar uma Ordem de Serviço</div>
                    </div>
                  </CardContent>
                </Card>

                <Link href={`/registrar/pmoc?u=${unitFromUrl}`}>
                  <Card className="bg-card border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Wind className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-base leading-tight">PMOC e Bebedouros</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Acesse o cronograma de manutenção preventiva</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href={`/registrar/materiais?u=${unitFromUrl}`}>
                  <Card className="bg-card border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <PackageOpen className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-base leading-tight">Retirada de Materiais e Ferramentas</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Registre retirada ou entrega de materiais</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
