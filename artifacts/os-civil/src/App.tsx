import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

import Dashboard from "@/pages/dashboard";
import Ordens from "@/pages/ordens";
import NovaOS from "@/pages/nova-os";
import OSDetail from "@/pages/os-detail";
import Tecnicos from "@/pages/tecnicos";
import Indicadores from "@/pages/indicadores";
import RegistrarOS from "@/pages/registrar-os";
import Cadastros from "@/pages/cadastros";
import Configuracoes from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ManagementRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/ordens" component={Ordens} />
        <Route path="/ordens/nova" component={NovaOS} />
        <Route path="/ordens/:id" component={OSDetail} />
        <Route path="/tecnicos" component={Tecnicos} />
        <Route path="/indicadores" component={Indicadores} />
        <Route path="/cadastros" component={Cadastros} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            {/* Rota pública para funcionários — sem sidebar de gestão */}
            <Route path="/registrar" component={RegistrarOS} />
            {/* Todas as outras rotas ficam dentro do layout de gestão */}
            <Route component={ManagementRouter} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
