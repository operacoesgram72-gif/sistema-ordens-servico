import type { Technician } from "@workspace/api-client-react";
import { Pencil, Trash2, Phone, Mail, Crown } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { photoSrc } from "./technician-form-dialog";

interface TechnicianListProps {
  technicians: Technician[] | undefined;
  isLoading: boolean;
  managerNameById: Map<number, string>;
  canManage: boolean;
  onEdit: (tech: Technician) => void;
  onDelete: (id: number) => void;
}

export function TechnicianList({ technicians, isLoading, managerNameById, canManage, onEdit, onDelete }: TechnicianListProps) {
  const colSpan = canManage ? 6 : 5;

  return (
    <div className="border border-border/50 rounded-md bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cargo / Especialidade</TableHead>
            <TableHead>Gestão</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={colSpan} className="h-24 text-center">Carregando...</TableCell></TableRow>
          ) : technicians?.length === 0 ? (
            <TableRow><TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">Nenhum técnico cadastrado.</TableCell></TableRow>
          ) : (
            technicians?.map((tech) => (
              <TableRow key={tech.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 border border-border/40">
                      <AvatarImage src={photoSrc(tech.photoUrl)} alt="" />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                        {tech.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {tech.name}
                    {tech.isCorporate && <Crown className="w-3.5 h-3.5 text-amber-500" aria-label="Cargo corporativo" />}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {tech.position && <span className="text-sm font-medium">{tech.position}</span>}
                    <Badge variant="secondary" className="font-normal w-fit">{tech.specialty}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tech.managerId ? managerNameById.get(tech.managerId) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground space-y-1">
                  {tech.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {tech.phone}</div>}
                  {tech.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {tech.email}</div>}
                  {!tech.phone && !tech.email && "-"}
                </TableCell>
                <TableCell>
                  {tech.active
                    ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Ativo</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(tech)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(tech.id)}>
                      <Trash2 className="w-4 h-4 text-destructive opacity-50 hover:opacity-100" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
