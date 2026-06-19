import { ServiceOrderCategory, ServiceOrderPriority, ServiceOrderStatus } from "@workspace/api-client-react";

export const CATEGORY_LABELS: Record<ServiceOrderCategory, string> = {
  manutencao: "Manutenção",
  conservacao: "Conservação",
  limpeza: "Limpeza",
  preventiva: "Preventiva",
  construcao: "Construção Civil",
};

export const PRIORITY_LABELS: Record<ServiceOrderPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_COLORS: Record<ServiceOrderPriority, string> = {
  baixa: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  media: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  alta: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  urgente: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  aberta: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  em_andamento: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  concluida: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  cancelada: "bg-red-500/10 text-red-500 border-red-500/20",
};
