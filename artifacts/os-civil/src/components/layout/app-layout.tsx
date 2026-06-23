import { Link, useLocation } from "wouter";
import { LayoutDashboard, ClipboardList, PlusCircle, Users, TrendingUp, Share2, Copy, BookUser, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { toast } = useToast();

  const navItems = [
    { href: "/", label: "Painel de Controle", icon: LayoutDashboard },
    { href: "/indicadores", label: "Indicadores", icon: TrendingUp },
    { href: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
    { href: "/ordens/nova", label: "Nova OS", icon: PlusCircle },
    { href: "/tecnicos", label: "Equipe Técnica", icon: Users },
    { href: "/cadastros", label: "Dados Cadastrais", icon: BookUser },
    { href: "/configuracoes", label: "Configurações", icon: Settings2 },
  ];

  const employeeUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/registrar`;

  const copyLink = () => {
    navigator.clipboard.writeText(employeeUrl).then(() => {
      toast({ title: "Link copiado!", description: "Envie para os funcionários registrarem chamados." });
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground dark">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col shrink-0">

        {/* Logo + Identidade da empresa */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo-amazonica.png"
              alt="Logo Rede Amazônica"
              className="h-10 w-10 object-contain"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight text-foreground truncate">
                Grupo Rede Amazônica
              </div>
              <div className="text-xs text-muted-foreground">Departamento: Operações</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Painel de Serviços
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? location === "/"
                : location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Link para funcionários */}
        <div className="p-3 border-t border-border">
          <div className="rounded-md bg-muted/50 border border-border/70 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Share2 className="w-3.5 h-3.5" />
              Link para Funcionários
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Compartilhe para que os funcionários registrem chamados.
            </p>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 px-3 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar link de registro
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
