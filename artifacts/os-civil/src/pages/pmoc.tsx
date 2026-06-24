import { useState } from "react";
import { Wind, Link as LinkIcon, Plus, Trash2, ExternalLink, Pencil, Check, X, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

type SavedLink = { id: string; label: string; url: string };
type ScheduleRow = { id: string; activity: string; months: boolean[] };

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

const defaultSchedule: ScheduleRow[] = [
  { id: genId(), activity: "Limpeza de filtros", months: Array(12).fill(false).map((_, i) => [0, 3, 6, 9].includes(i)) },
  { id: genId(), activity: "Verificação de gás", months: Array(12).fill(false).map((_, i) => [5, 11].includes(i)) },
  { id: genId(), activity: "Higienização de bebedouros", months: Array(12).fill(true) },
  { id: genId(), activity: "Troca de filtro de bebedouro", months: Array(12).fill(false).map((_, i) => [2, 8].includes(i)) },
];

export default function Pmoc() {
  const { toast } = useToast();

  const [links, setLinks] = useState<SavedLink[]>([
    { id: genId(), label: "Planilha PMOC 2025", url: "https://docs.google.com/spreadsheets" },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultSchedule);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState("");
  const [newActivity, setNewActivity] = useState("");

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const url = newUrl.startsWith("http") ? newUrl : `https://${newUrl}`;
    setLinks((prev) => [...prev, { id: genId(), label: newLabel.trim(), url }]);
    setNewLabel("");
    setNewUrl("");
    toast({ title: "Link adicionado!" });
  };

  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));

  const toggleMonth = (rowId: string, monthIdx: number) => {
    setSchedule((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, months: row.months.map((v, i) => (i === monthIdx ? !v : v)) }
          : row
      )
    );
  };

  const startEditRow = (row: ScheduleRow) => {
    setEditingRowId(row.id);
    setEditingActivity(row.activity);
  };

  const confirmEditRow = (id: string) => {
    setSchedule((prev) =>
      prev.map((row) => (row.id === id ? { ...row, activity: editingActivity } : row))
    );
    setEditingRowId(null);
  };

  const removeRow = (id: string) => setSchedule((prev) => prev.filter((r) => r.id !== id));

  const addRow = () => {
    if (!newActivity.trim()) return;
    setSchedule((prev) => [...prev, { id: genId(), activity: newActivity.trim(), months: Array(12).fill(false) }]);
    setNewActivity("");
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wind className="w-7 h-7 text-primary" />
          PMOC e Bebedouros
        </h1>
        <p className="text-muted-foreground mt-1">
          Plano de Manutenção, Operação e Controle — links úteis e cronograma anual.
        </p>
      </div>

      {/* Links Externos */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkIcon className="w-5 h-5 text-primary" />
            Links Externos
          </CardTitle>
          <CardDescription>
            Adicione links para planilhas, documentos ou sistemas externos (Google Sheets, Drive, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-border/70 bg-muted/30 group"
                >
                  <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                    title="Abrir link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => removeLink(link.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div className="space-y-1">
              <Label className="text-xs">Nome / Descrição</Label>
              <Input
                placeholder="Ex: Planilha PMOC"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                />
                <Button onClick={addLink} size="sm" className="shrink-0 gap-1.5">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cronograma Anual */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-primary" />
            Cronograma Anual de Manutenção
          </CardTitle>
          <CardDescription>
            Marque os meses para cada atividade. Clique no nome para editar. Independente do ano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-semibold text-xs uppercase tracking-wide w-56 min-w-[14rem]">
                    Atividade
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-center py-2 px-1 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide w-10 min-w-[2.5rem]">
                      {m.slice(0, 3)}
                    </th>
                  ))}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {schedule.map((row) => (
                  <tr key={row.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3">
                      {editingRowId === row.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingActivity}
                            onChange={(e) => setEditingActivity(e.target.value)}
                            className="h-7 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && confirmEditRow(row.id)}
                            autoFocus
                          />
                          <button onClick={() => confirmEditRow(row.id)} className="text-primary hover:text-primary/80">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingRowId(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground">{row.activity}</span>
                          <button
                            onClick={() => startEditRow(row)}
                            className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    {row.months.map((active, idx) => (
                      <td key={idx} className="text-center py-2 px-1">
                        <button
                          onClick={() => toggleMonth(row.id, idx)}
                          className={`w-6 h-6 rounded-sm mx-auto transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground"
                          }`}
                          title={`${active ? "Desmarcar" : "Marcar"} ${MONTHS[idx]}`}
                        >
                          {active && <Check className="w-3.5 h-3.5 mx-auto" />}
                        </button>
                      </td>
                    ))}
                    <td className="text-center py-2 px-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover linha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <Input
              placeholder="Nova atividade..."
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRow()}
              className="max-w-xs"
            />
            <Button onClick={addRow} size="sm" variant="outline" className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              Adicionar Atividade
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
