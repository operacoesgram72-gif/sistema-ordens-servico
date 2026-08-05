import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation, useSearch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { UnitProvider, type Unit } from "@/contexts/unit-context";
import { ShareProvider, useShare } from "@/contexts/share-context";
import { StatusAlertsProvider } from "@/contexts/status-alerts-context";
import CalendarAlerts from "@/components/calendar-alerts";

const Dashboard         = lazy(() => import("@/pages/dashboard"));
const Ordens            = lazy(() => import("@/pages/ordens"));
const NovaOS            = lazy(() => import("@/pages/nova-os"));
const OSDetail          = lazy(() => import("@/pages/os-detail"));
const Tecnicos          = lazy(() => import("@/pages/tecnicos"));
const Indicadores       = lazy(() => import("@/pages/indicadores"));
const RegistrarOS       = lazy(() => import("@/pages/registrar-os"));
const RegistrarMateriais = lazy(() => import("@/pages/registrar-materiais"));
const MenuFuncionario   = lazy(() => import("@/pages/menu-funcionario"));
const Cadastros         = lazy(() => import("@/pages/cadastros"));
const Fornecedores      = lazy(() => import("@/pages/fornecedores"));
const FornecedorPublico   = lazy(() => import("@/pages/fornecedor-publico"));
const FornecedoresPublico = lazy(() => import("@/pages/fornecedores-publico"));
const ComprasServicos     = lazy(() => import("@/pages/compras-servicos"));
const ComprasServicosPublico = lazy(() => import("@/pages/compras-servicos-publico"));
const Configuracoes     = lazy(() => import("@/pages/configuracoes"));
const Pmoc              = lazy(() => import("@/pages/pmoc"));
const RetiradaMateriais = lazy(() => import("@/pages/retirada-materiais"));
const Calendario        = lazy(() => import("@/pages/calendario"));
const Arquivos          = lazy(() => import("@/pages/arquivos"));
const Processos         = lazy(() => import("@/pages/processos"));
const RegistrarPmoc     = lazy(() => import("@/pages/registrar-pmoc"));
const FecharOS          = lazy(() => import("@/pages/fechar-os"));
const OsPublica         = lazy(() => import("@/pages/os-publica"));
const NotFound          = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes — reduces background refetches
      gcTime:    1000 * 60 * 15,  // 15 minutes — keep unused data in memory longer
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,   // refresh after network reconnects
    },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
      Carregando…
    </div>
  );
}

function MaintenancePage() {
  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <img src="/logo-amazonica.png" alt="Logo" className="h-16 w-16 object-contain opacity-70" />
        <div>
          <h1 className="text-2xl font-bold">Sistema em Manutenção</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            O sistema está temporariamente indisponível para manutenção programada.
            Por favor, aguarde e tente novamente em alguns instantes.
          </p>
        </div>
        <div className="text-xs text-muted-foreground/50 mt-4">GRAM Operações — Grupo Rede Amazônica</div>
      </div>
    </div>
  );
}

/**
 * Catch-all guard:
 * - Maintenance mode → MaintenancePage
 * - ?view=1 on /calendario → standalone calendar (no sidebar/admin bar)
 * - PWA standalone mode (but NOT for share/view links) → redirect to /registrar
 * - Everything else → ManagementRouter
 */
function StandaloneGuard() {
  const [location] = useLocation();
  const search = useSearch();

  const params = new URLSearchParams(search);
  const isViewOnly = params.get("view") === "1";
  const isShareLink = params.has("share");
  const isCreatorMode = params.get("modo") === "criador";

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;

  const isOffline = !isCreatorMode && (() => {
    try { return localStorage.getItem("gram_system_online") === "false"; } catch { return false; }
  })();

  if (isOffline) return <MaintenancePage />;

  // Calendar view-only mode: render WITHOUT AppLayout (no sidebar, no admin elements)
  if (isViewOnly && location === "/calendario") {
    return (
      <UnitProvider>
        <div className="min-h-screen bg-background text-foreground dark">
          <Suspense fallback={<PageFallback />}>
            <Calendario />
          </Suspense>
        </div>
      </UnitProvider>
    );
  }

  // PWA standalone: redirect to employee area — but preserve share/view links
  if (isStandalone && !isShareLink && !isViewOnly) {
    return <Redirect to="/registrar" />;
  }

  return <ManagementRouter />;
}

function ManagementRouter() {
  const { isShareMode, shareUnit, isAMShare } = useShare();

  const lockedUnit: Unit | null = isShareMode && !isAMShare && shareUnit
    ? shareUnit as Unit
    : null;

  return (
    <UnitProvider lockedUnit={lockedUnit}>
      <StatusAlertsProvider>
        <AppLayout>
          <Suspense fallback={<PageFallback />}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/ordens" component={Ordens} />
              <Route path="/ordens/nova" component={NovaOS} />
              <Route path="/ordens/:id" component={OSDetail} />
              <Route path="/tecnicos" component={Tecnicos} />
              <Route path="/indicadores" component={Indicadores} />
              <Route path="/cadastros" component={Cadastros} />
              <Route path="/fornecedores" component={Fornecedores} />
              <Route path="/compras" component={ComprasServicos} />
              <Route path="/configuracoes" component={Configuracoes} />
              <Route path="/pmoc" component={Pmoc} />
              <Route path="/retirada-materiais" component={RetiradaMateriais} />
              <Route path="/calendario" component={Calendario} />
              <Route path="/arquivos" component={Arquivos} />
              <Route path="/processos" component={Processos} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </AppLayout>
        {/* Calendar alerts: shown once per session when tomorrow has scheduled services */}
        <CalendarAlerts />
      </StatusAlertsProvider>
    </UnitProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ShareProvider>
            <Suspense fallback={<PageFallback />}>
              <Switch>
                <Route path="/registrar/os" component={RegistrarOS} />
                <Route path="/registrar/pmoc" component={RegistrarPmoc} />
                <Route path="/registrar/materiais" component={RegistrarMateriais} />
                <Route path="/registrar/fechar-os" component={FecharOS} />
                <Route path="/registrar" component={MenuFuncionario} />
                <Route path="/fornecedores/publico/:id" component={FornecedorPublico} />
                <Route path="/fornecedores/publico" component={FornecedoresPublico} />
                <Route path="/compras/publico/:unidade" component={ComprasServicosPublico} />
                <Route path="/os-publica/:token" component={OsPublica} />
                <Route component={StandaloneGuard} />
              </Switch>
            </Suspense>
          </ShareProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
