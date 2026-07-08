import { useMemo, useState } from "react";
import { Users, Plus, RefreshCw, Network, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useListTechnicians,
  useCreateTechnician,
  useUpdateTechnician,
  useDeleteTechnician,
  getListTechniciansQueryKey,
  type Technician,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUnit } from "@/contexts/unit-context";
import { TechnicianList } from "@/components/tecnicos/technician-list";
import { TechnicianFormDialog } from "@/components/tecnicos/technician-form-dialog";
import { OrgChart } from "@/components/tecnicos/org-chart";

export default function Tecnicos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unit } = useUnit();
  const canManage = unit === "AM";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);

  const queryKey = getListTechniciansQueryKey({ unidade: unit });
  const { data: technicians, isLoading } = useListTechnicians(
    { unidade: unit },
    { query: { queryKey } }
  );

  const createTech = useCreateTechnician();
  const updateTech = useUpdateTechnician();
  const deleteTech = useDeleteTechnician();

  const managerNameById = useMemo(() => {
    const map = new Map<number, string>();
    technicians?.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [technicians]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListTechniciansQueryKey() });

  const openNewModal = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tech: Technician) => {
    setEditing(tech);
    setIsModalOpen(true);
  };

  const handleSubmit = (values: {
    name: string;
    specialty: string;
    position?: string;
    area?: string | null;
    phone?: string;
    email?: string;
    managerId: number | null;
    photoUrl: string | null;
    active: boolean;
  }) => {
    const isEditing = editing !== null;

    if (isEditing) {
      updateTech.mutate(
        { id: editing!.id, data: values },
        {
          onSuccess: () => {
            toast({ title: "Sucesso", description: "Técnico atualizado." });
            refresh();
            setIsModalOpen(false);
          },
          onError: () => {
            toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
          },
        }
      );
    } else {
      createTech.mutate(
        { data: { ...values, unidade: unit } },
        {
          onSuccess: () => {
            toast({ title: "Sucesso", description: "Técnico cadastrado." });
            refresh();
            setIsModalOpen(false);
          },
          onError: () => {
            toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este técnico?")) {
      deleteTech.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Excluído", description: "Técnico removido do sistema." });
            refresh();
          },
        }
      );
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipes</h1>
          <p className="text-muted-foreground mt-1">
            {canManage
              ? "Gerencie os profissionais de campo e a hierarquia da equipe."
              : `Consulta somente leitura da equipe da unidade ${unit}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh} title="Atualizar lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button onClick={openNewModal}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Técnico
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed flex gap-3 items-start">
          <Users className="w-4 h-4 shrink-0 mt-0.5" />
          O cadastro, a edição e a hierarquia da equipe são administrados exclusivamente pela unidade{" "}
          <strong className="text-foreground">AM — Amazonas</strong>.
        </div>
      )}

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">
            <List className="w-4 h-4 mr-2" /> Lista
          </TabsTrigger>
          <TabsTrigger value="organograma">
            <Network className="w-4 h-4 mr-2" /> Organograma
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <TechnicianList
            technicians={technicians}
            isLoading={isLoading}
            managerNameById={managerNameById}
            canManage={canManage}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="organograma">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-16">Carregando organograma...</div>
          ) : (
            <OrgChart technicians={technicians ?? []} />
          )}
        </TabsContent>
      </Tabs>

      {canManage && (
        <TechnicianFormDialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          editing={editing}
          managers={technicians ?? []}
          onSubmit={handleSubmit}
          isSaving={createTech.isPending || updateTech.isPending}
        />
      )}
    </div>
  );
}
