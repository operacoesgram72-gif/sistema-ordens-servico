import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ClipboardList, PlusCircle, Users, TrendingUp,
  Share2, Copy, BookUser, Settings2, Wind, PackageOpen, CalendarDays, Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUnit, UNITS } from "@/contexts/unit-context";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const navSections = [
  {
    label: "Visão Geral",
    items: [
      { href: "/", label: "Painel de Controle", icon: LayoutDashboard },
      { href: "/indicadores", label: "Indicadores", icon: TrendingUp },
      { href: "/calendario", label: "Calendário", icon: CalendarDays },
    ],
  },
  {
    label: "Ordens de Serviço",
    items: [
      { href: "/ordens", label: "Listar OS", icon: ClipboardList },
      { href: "/ordens/nova", label: "Nova OS", icon: PlusCircle },
    ],
  },
  {
    label: "Manutenção",
    items: [
      { href: "/pmoc", label: "PMOC e Bebedouros", icon: Wind },
      { href: "/retirada-materiais", label: "Retirada de Materiais", icon: PackageOpen },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/arquivos", label: "Arquivos", icon: Folder },
      { href: "/tecnicos", label: "Equipes", icon: Users },
      { href: "/cadastros", label: "Dados Cadastrais", icon: BookUser },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings2 },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { unit, setUnit } = useUnit();

  const employeeUrl = `${window.location.origin}${BASE_URL}/registrar?u=${unit}`;

  const copyLink = () => {
    navigator.clipboard.writeText(employeeUrl).then(() => {
      toast({ title: "Link copiado!", description: `Link da unidade ${unit} copiado.` });
    });
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground dark">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col shrink-0">

        {/* Logo + Identidade + Unit Selector */}
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

          {/* Painel label */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Painel de Serviços
            </span>
          </div>

          {/* Unit selector */}
          <div className="mt-2">
            <p className="text-[10px] text-muted-foreground/60 mb-1.5 uppercase tracking-widest">Unidade</p>
            <div className="flex flex-wrap gap-1">
              {UNITS.map((u) => (
                <button
                  key={u.key}
                  onClick={() => setUnit(u.key)}
                  title={u.name}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono font-bold transition-all border",
                    unit === u.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                  )}
                >
                  {u.key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 mr-3 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Employee link (per-unit) */}
        <div className="p-3 border-t border-border">
          <div className="rounded-md bg-muted/50 border border-border/70 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Share2 className="w-3.5 h-3.5" />
              Link Funcionários — <span className="text-primary">{unit}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Os funcionários da unidade <strong>{unit}</strong> usam este link para registrar chamados.
            </p>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 px-3 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar link — {unit}
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
