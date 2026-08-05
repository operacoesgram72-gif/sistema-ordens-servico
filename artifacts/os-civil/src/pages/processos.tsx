import { useState } from "react";
import { ClipboardList, Target, ListChecks, FileCheck2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { PROCESSOS_CATEGORIAS } from "@/data/processos-content";

export default function Processos() {
  const [activeId, setActiveId] = useState(PROCESSOS_CATEGORIAS[0]?.id ?? "");
  const active = PROCESSOS_CATEGORIAS.find((c) => c.id === activeId) ?? PROCESSOS_CATEGORIAS[0];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-6 md:px-8 pt-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-primary" />
          Processos e Procedimentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Consulte o objetivo, o processo e os procedimentos padronizados de cada área de atuação.
        </p>
      </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6 md:px-8 pb-8 pt-4 max-w-6xl mx-auto space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PROCESSOS_CATEGORIAS.map((categoria) => {
          const Icon = categoria.icon;
          const isActive = categoria.id === active?.id;
          return (
            <button
              key={categoria.id}
              type="button"
              onClick={() => setActiveId(categoria.id)}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-card hover:bg-muted/40"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-2", isActive ? "text-primary" : "text-muted-foreground")} />
              <div className={cn("text-sm font-semibold leading-tight", isActive && "text-primary")}>
                {categoria.title}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <Card key={active.id} className="border-border/60">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <active.icon className="w-6 h-6 text-primary shrink-0" />
              <h2 className="text-xl font-bold tracking-tight">{active.title}</h2>
            </div>

            <Accordion type="multiple" defaultValue={["objetivo", "processo", "procedimentos"]} className="w-full">
              <AccordionItem value="objetivo">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    Objetivo
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{active.objetivo}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="processo">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-muted-foreground" />
                    Processo
                    <Badge variant="secondary" className="ml-1 font-normal">{active.processo.length} etapas</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-2">
                    {active.processo.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground leading-relaxed pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="procedimentos" className="border-b-0">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-muted-foreground" />
                    Procedimentos
                    <Badge variant="secondary" className="ml-1 font-normal">{active.procedimentos.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {active.procedimentos.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                        <span className="shrink-0 text-primary">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    
        </div>
      </div>
    </div>
  );
}
