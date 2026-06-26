import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { UnitProvider } from "@/contexts/unit-context";

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
const Configuracoes     = lazy(() => import("@/pages/configuracoes"));
const Pmoc              = lazy(() => import("@/pages/pmoc"));
const RetiradaMateriais = lazy(() => import("@/pages/retirada-materiais"));
const Calendario        = lazy(() => import("@/pages/calendario"));
const Arquivos          = lazy(() => import("@/pages/arquivos"));
const RegistrarPmoc     = lazy(() => import("@/pages/registrar-pmoc"));
const NotFound          = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
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

function ManagementRouter() {
  return (
    <UnitProvider>
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
            <Route path="/configuracoes" component={Configuracoes} />
            <Route path="/pmoc" component={Pmoc} />
            <Route path="/retirada-materiais" component={RetiradaMateriais} />
            <Route path="/calendario" component={Calendario} />
            <Route path="/arquivos" component={Arquivos} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AppLayout>
    </UnitProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Suspense fallback={<PageFallback />}>
            <Switch>
              <Route path="/registrar/os" component={RegistrarOS} />
              <Route path="/registrar/pmoc" component={RegistrarPmoc} />
              <Route path="/registrar/materiais" component={RegistrarMateriais} />
              <Route path="/registrar" component={MenuFuncionario} />
              <Route component={ManagementRouter} />
            </Switch>
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
