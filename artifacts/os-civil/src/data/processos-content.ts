import { HardHat, Wrench, SprayCan, ShieldCheck, type LucideIcon } from "lucide-react";

// Data-driven content for the "Processos e Procedimentos" page. Adding a new
// category or updating an existing one only requires editing this array —
// the page component itself never needs to change.
export interface ProcessoCategoria {
  id: string;
  title: string;
  icon: LucideIcon;
  objetivo: string;
  processo: string[];
  procedimentos: string[];
}

export const PROCESSOS_CATEGORIAS: ProcessoCategoria[] = [
  {
    id: "projetos-obras",
    title: "Projetos e Obras",
    icon: HardHat,
    objetivo:
      "Planejar, desenvolver, executar e acompanhar obras, reformas e adequações das unidades, garantindo qualidade, segurança, prazo e controle de custos.",
    processo: [
      "Receber a solicitação.",
      "Realizar vistoria técnica.",
      "Elaborar escopo do projeto.",
      "Desenvolver orçamento.",
      "Solicitar aprovação.",
      "Contratar fornecedor, quando necessário.",
      "Elaborar cronograma.",
      "Acompanhar a execução.",
      "Registrar evidências fotográficas.",
      "Realizar vistoria final.",
      "Encerrar a obra.",
      "Arquivar toda a documentação.",
    ],
    procedimentos: [
      "Realizar levantamento técnico.",
      "Registrar fotos antes, durante e após a execução.",
      "Validar orçamento antes da contratação.",
      "Controlar cronograma.",
      "Conferir qualidade dos serviços.",
      "Registrar alterações ocorridas durante a execução.",
      "Emitir relatório final.",
    ],
  },
  {
    id: "manutencoes-reparos",
    title: "Manutenções e Reparos",
    icon: Wrench,
    objetivo: "Garantir o funcionamento contínuo das instalações e equipamentos.",
    processo: [
      "Receber Ordem de Serviço.",
      "Classificar prioridade.",
      "Programar atendimento.",
      "Executar diagnóstico.",
      "Realizar manutenção.",
      "Registrar materiais utilizados.",
      "Registrar fotos.",
      "Atualizar status.",
      "Encerrar a Ordem de Serviço.",
    ],
    procedimentos: [
      "Utilizar EPIs.",
      "Registrar fotos antes e depois.",
      "Informar peças substituídas.",
      "Atualizar observações técnicas.",
      "Confirmar conclusão junto ao solicitante.",
    ],
  },
  {
    id: "conservacao-limpeza",
    title: "Conservação e Limpeza",
    icon: SprayCan,
    objetivo: "Manter os ambientes limpos, organizados e conservados.",
    processo: [
      "Planejar cronograma.",
      "Distribuir equipes.",
      "Executar limpeza.",
      "Realizar inspeção.",
      "Corrigir não conformidades.",
      "Registrar ocorrências.",
      "Solicitar reposição de materiais.",
    ],
    procedimentos: [
      "Utilizar produtos adequados.",
      "Respeitar o cronograma.",
      "Manter equipamentos organizados.",
      "Informar qualquer irregularidade encontrada.",
      "Registrar necessidades de manutenção observadas durante a limpeza.",
    ],
  },
  {
    id: "seguranca-patrimonial",
    title: "Segurança Patrimonial",
    icon: ShieldCheck,
    objetivo: "Garantir a segurança das pessoas, instalações e patrimônio da empresa.",
    processo: [
      "Controlar acesso.",
      "Monitorar câmeras.",
      "Realizar rondas.",
      "Registrar visitantes.",
      "Atender ocorrências.",
      "Acionar responsáveis quando necessário.",
      "Registrar incidentes.",
    ],
    procedimentos: [
      "Identificar visitantes.",
      "Controlar entrada e saída.",
      "Registrar todas as ocorrências.",
      "Preservar evidências quando houver incidentes.",
      "Comunicar imediatamente qualquer situação de risco.",
    ],
  },
];
