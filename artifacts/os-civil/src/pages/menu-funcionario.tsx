import { Link } from "wouter";
import { ClipboardList, Wind, PackageOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function MenuFuncionario() {
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
        <div className="ml-auto">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">
            Painel de Serviços
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Área do Funcionário</h1>
            <p className="text-muted-foreground text-sm">
              Selecione uma das opções abaixo para continuar.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/registrar/os">
              <Card className="bg-card border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <ClipboardList className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-base leading-tight">Inserir Ordem de Serviço</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Registre um novo chamado de manutenção</div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/pmoc">
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

            <Link href="/registrar/materiais">
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
        </div>
      </div>
    </div>
  );
}
