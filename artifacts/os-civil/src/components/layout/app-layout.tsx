import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ClipboardList, PlusCircle, Users, TrendingUp,
  Share2, Copy, BookUser, Settings2, Wind, PackageOpen, CalendarDays, Folder,
  Menu, X, Wifi, WifiOff, Truck, Lock, ClipboardCheck, ShoppingCart,
  Moon, Sun,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUnit, UNITS } from "@/contexts/unit-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useShare } from "@/contexts/share-context";
import { StatusAlertsBell } from "@/components/layout/status-alerts-bell";

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
    label: "Processos",
    items: [
      { href: "/processos", label: "Processos e Procedimentos", icon: ClipboardCheck },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/arquivos", label: "Arquivos", icon: Folder },
      { href: "/tecnicos", label: "Equipes", icon: Users },
      { href: "/cadastros", label: "Dados Cadastrais", icon: BookUser },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/compras", label: "Compras e Serviços", icon: ShoppingCart },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings2 },
    ],
  },
];

const BASE_FETCH = import.meta.env.BASE_URL.replace(/\/$/, "");

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { unit, setUnit, locked } = useUnit();
  const { isShareMode } = useShare();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  // For AM: prefetch all-units summary (default view); for others: prefetch own unit
  const dashEffectiveUnit = unit !== "AM" ? unit : undefined;

  const handleNavHover = (href: string) => {
    if (href === "/") {
      void queryClient.prefetchQuery({
        queryKey: ["dashboard-summary", dashEffectiveUnit],
        queryFn: () => fetch(`${BASE_FETCH}/api/dashboard/summary${dashEffectiveUnit ? `?unidade=${dashEffectiveUnit}` : ""}`).then(r => r.json()),
        staleTime: 1000 * 60 * 2,
      });
      void queryClient.prefetchQuery({
        queryKey: ["dashboard-stats", "monthly"],
        queryFn: () => fetch(`${BASE_FETCH}/api/dashboard/stats?period=monthly`).then(r => r.json()),
        staleTime: 1000 * 60 * 2,
      });
    } else if (href === "/ordens") {
      void queryClient.prefetchQuery({
        queryKey: ["service-orders", "", "all", "monthly", "all", "all", unit],
        queryFn: () => fetch(`${BASE_FETCH}/api/service-orders?period=monthly&unidade=${unit}`).then(r => r.json()),
        staleTime: 1000 * 60 * 2,
      });
    }
  };

  const employeeUrl = `${window.location.origin}${BASE_URL}/registrar?u=${unit}`;

  const copyLink = () => {
    navigator.clipboard.writeText(employeeUrl).then(() => {
      toast({ title: "Link copiado!", description: `Link da unidade ${unit} copiado.` });
    });
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  return (
    <>
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight text-foreground truncate">Grupo Rede Amazônica</div>
            <div className="text-xs text-muted-foreground">Departamento: Operações</div>
          </div>
          <StatusAlertsBell variant="sidebar" />
        </div>
        <div className="mt-3 pt-3 border-t border-border/60">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Painel de Serviços</span>
        </div>
        <div className="mt-2">
          <p className="text-[10px] text-muted-foreground/60 mb-1.5 uppercase tracking-widest">Unidade</p>
          {locked ? (
            /* Share mode: unit is locked — show it as static badge */
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary text-primary-foreground border border-primary">
                {unit}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Lock className="w-2.5 h-2.5" /> Unidade bloqueada
              </span>
            </div>
          ) : (
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
          )}
        </div>
      </div>

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
                    onClick={onNavClick}
                    onMouseEnter={() => handleNavHover(item.href)}
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
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50 leading-snug">
            Desenvolvido por <span className="text-muted-foreground/70 font-medium">Aristoteles Melo</span>
          </p>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Alternar tema"
          >
            {theme === "dark"
              ? <Sun className="w-3.5 h-3.5" />
              : <Moon className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { pendingCount } = useOfflineQueue();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground">

      {/* ── Online/Offline banner (mobile + desktop) ── */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/90 text-black text-xs font-semibold py-1.5 px-4 md:pl-64">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sem conexão — Modo offline
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* ── MOBILE TOP BAR ── */}
      <header
        className={cn(
          "md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 safe-top",
          !isOnline && "mt-7"
        )}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo-amazonica.png" alt="Logo" className="h-7 w-7 object-contain" />
          <span className="font-bold text-sm text-foreground">Ordem de Serviço</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusAlertsBell variant="topbar" />
          {isOnline
            ? <Wifi className="w-4 h-4 text-emerald-500" />
            : <WifiOff className="w-4 h-4 text-amber-500" />
          }
        </div>
      </header>

      {/* ── MOBILE DRAWER BACKDROP ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MOBILE DRAWER SIDEBAR ── */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col shrink-0 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
          className="absolute top-3 right-3 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-64 border-r border-border bg-card flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/*
          Scroll container is stable (no key) so scroll position is preserved
          when navigating back. Inner div uses key={location} to trigger the
          page-enter CSS animation without resetting the scroll container.
        */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div key={location} className="page-enter flex-1 min-h-0 flex flex-col overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
