import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { UnitProvider } from "@/contexts/unit-context";

import Dashboard from "@/pages/dashboard";
import Ordens from "@/pages/ordens";
import NovaOS from "@/pages/nova-os";
import OSDetail from "@/pages/os-detail";
import Tecnicos from "@/pages/tecnicos";
import Indicadores from "@/pages/indicadores";
import RegistrarOS from "@/pages/registrar-os";
import RegistrarMateriais from "@/pages/registrar-materiais";
import MenuFuncionario from "@/pages/menu-funcionario";
import Cadastros from "@/pages/cadastros";
import Configuracoes from "@/pages/configuracoes";
import Pmoc from "@/pages/pmoc";
import RetiradaMateriais from "@/pages/retirada-materiais";
import Calendario from "@/pages/calendario";
import Arquivos from "@/pages/arquivos";
import RegistrarPmoc from "@/pages/registrar-pmoc";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ManagementRouter() {
  return (
    <UnitProvider>
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
          <Route path="/pmoc" component={Pmoc} />
          <Route path="/retirada-materiais" component={RetiradaMateriais} />
          <Route path="/calendario" component={Calendario} />
          <Route path="/arquivos" component={Arquivos} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </UnitProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/registrar/os" component={RegistrarOS} />
            <Route path="/registrar/pmoc" component={RegistrarPmoc} />
            <Route path="/registrar/materiais" component={RegistrarMateriais} />
            <Route path="/registrar" component={MenuFuncionario} />
            <Route component={ManagementRouter} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
