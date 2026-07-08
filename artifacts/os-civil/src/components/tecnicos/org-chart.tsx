import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users, User, Crown } from "lucide-react";
import type { Technician } from "@workspace/api-client-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { photoSrc } from "./technician-form-dialog";

interface TreeNode {
  tech: Technician;
  children: TreeNode[];
}

function buildForest(
  technicians: Technician[]
): { roots: TreeNode[]; countOf: Map<number, number>; orphaned: Technician[] } {
  const byId = new Map(technicians.map((t) => [t.id, t]));
  const childrenOf = new Map<number, Technician[]>();
  const roots: Technician[] = [];

  for (const t of technicians) {
    if (t.managerId && byId.has(t.managerId)) {
      const list = childrenOf.get(t.managerId) ?? [];
      list.push(t);
      childrenOf.set(t.managerId, list);
    } else {
      roots.push(t);
    }
  }

  function build(t: Technician): TreeNode {
    const children = (childrenOf.get(t.id) ?? []).map(build);
    return { tech: t, children };
  }

  const countOf = new Map<number, number>();
  function countSubordinates(node: TreeNode): number {
    const total = node.children.reduce((sum, c) => sum + 1 + countSubordinates(c), 0);
    countOf.set(node.tech.id, total);
    return total;
  }

  const rootNodes = roots.map(build);
  rootNodes.forEach(countSubordinates);

  // Anything not reachable from a root is stuck in a cycle (managerId chain
  // that loops back on itself without ever bottoming out at a valid root).
  // The server blocks new cycles, but pre-existing data could still have
  // one — surface those technicians separately instead of hiding them.
  const visited = new Set<number>();
  function markVisited(node: TreeNode) {
    visited.add(node.tech.id);
    node.children.forEach(markVisited);
  }
  rootNodes.forEach(markVisited);
  const orphaned = technicians.filter((t) => !visited.has(t.id));

  return { roots: rootNodes, countOf, orphaned };
}

function OrgCard({ node, countOf, defaultExpanded }: { node: TreeNode; countOf: Map<number, number>; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const subCount = countOf.get(node.tech.id) ?? 0;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm min-w-[220px] ${
          node.tech.isCorporate ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"
        }`}
      >
        <Avatar className="w-10 h-10 border border-border/40 shrink-0">
          <AvatarImage src={photoSrc(node.tech.photoUrl)} alt="" />
          <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
            {node.tech.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate">{node.tech.name}</p>
            {node.tech.isCorporate && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {node.tech.position || node.tech.specialty}
          </p>
          {!node.tech.active && (
            <Badge variant="outline" className="mt-1 text-[10px] py-0 h-4 text-muted-foreground">Inativo</Badge>
          )}
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 shrink-0"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            <Users className="w-3 h-3" />
            {subCount}
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="relative pt-6 mt-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-6">
            {node.children.map((child) => (
              <OrgCard key={child.tech.id} node={child} countOf={countOf} defaultExpanded={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a data-driven org chart. Corporate roles (Eduardo Lopes → Salvino
 * Guerra → Marco Carneiro) sit at the top and are shared across every unit.
 * Anyone who reports directly to a corporate role is treated as the unit's
 * top management ("Área Administrativa"); everyone deeper in the tree is
 * "Área Operacional (Campo)".
 */
export function OrgChart({ technicians }: { technicians: Technician[] }) {
  const { roots, countOf, orphaned } = useMemo(() => buildForest(technicians), [technicians]);

  if (technicians.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhum técnico cadastrado para montar o organograma.
      </div>
    );
  }

  // Tier 0: the 3 shared corporate roles. Tier 1: whoever reports directly to
  // one of them — that's each unit's own top management. Together these form
  // "Área Administrativa"; everyone deeper in the tree is "Área Operacional".
  const corporateIds = new Set(technicians.filter((t) => t.isCorporate).map((t) => t.id));
  const unitTopManagerIds = new Set(
    technicians.filter((t) => t.managerId && corporateIds.has(t.managerId)).map((t) => t.id)
  );

  function findNodes(nodes: TreeNode[], ids: Set<number>): TreeNode[] {
    const found: TreeNode[] = [];
    for (const node of nodes) {
      if (ids.has(node.tech.id)) found.push(node);
      found.push(...findNodes(node.children, ids));
    }
    return found;
  }

  const operationalCards = findNodes(roots, unitTopManagerIds).flatMap((n) => n.children);

  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" /> Área Administrativa
        </h3>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-6 overflow-x-auto">
          <div className="flex justify-center min-w-fit">
            {roots.map((root) => (
              <OrgCard key={root.tech.id} node={root} countOf={countOf} defaultExpanded />
            ))}
          </div>
        </div>
      </section>

      {operationalCards.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Área Operacional (Campo)
          </h3>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 overflow-x-auto">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-6 min-w-fit">
              {operationalCards.map((node) => (
                <OrgCard key={node.tech.id} node={node} countOf={countOf} defaultExpanded={false} />
              ))}
            </div>
          </div>
        </section>
      )}

      {orphaned.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Sem Hierarquia Definida
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Estes técnicos possuem uma referência de gestão inválida (ciclo) e não puderam ser posicionados no organograma.
          </p>
          <div className="rounded-xl border border-destructive/30 bg-destructive/[0.03] p-6 overflow-x-auto">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-6 min-w-fit">
              {orphaned.map((tech) => (
                <OrgCard key={tech.id} node={{ tech, children: [] }} countOf={countOf} defaultExpanded={false} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
