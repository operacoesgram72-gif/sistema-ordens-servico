import { useListSuppliers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Truck } from "lucide-react";

export default function FornecedoresPublico() {
  const { data: suppliers, isLoading } = useListSuppliers();

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Relação de Fornecedores</div>
        </div>
      </header>

      <div className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Fornecedores</h1>
            <p className="text-sm text-muted-foreground mt-1">Consulta pública — somente leitura.</p>
          </div>

          <Card className="bg-card border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ/CPF</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Atendente</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : !suppliers || suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Truck className="w-8 h-8 opacity-30" />
                            <span>Nenhum fornecedor cadastrado.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((s) => (
                        <TableRow key={s.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{s.razaoSocial || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell className="font-mono text-sm">{s.cnpjCpf || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell className="text-sm">
                            {s.cidade || s.uf ? [s.cidade, s.uf].filter(Boolean).join(" / ") : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell className="text-sm">{s.contato || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell className="text-sm">{s.email || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell className="text-sm">{s.atendente || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell>
                            {s.localizacaoLink && (
                              <a
                                href={s.localizacaoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                title="Abrir localização"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
