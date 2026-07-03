import { useParams } from "wouter";
import { useGetSupplier } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Truck } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">
        {value || <span className="text-muted-foreground italic">Não informado</span>}
      </div>
    </div>
  );
}

export default function FornecedorPublico() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: supplier, isLoading, isError } = useGetSupplier(id, {
    query: { enabled: Number.isFinite(id) },
  } as any);

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Ficha de Fornecedor</div>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : isError || !supplier ? (
            <Card className="bg-card border-border/50">
              <CardContent className="p-10 flex flex-col items-center text-center gap-3">
                <Truck className="w-10 h-10 text-muted-foreground opacity-40" />
                <div className="text-lg font-semibold">Fornecedor não encontrado</div>
                <p className="text-sm text-muted-foreground">O link pode estar incorreto ou o cadastro foi removido.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border/50">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold leading-tight">{supplier.razaoSocial || "Fornecedor"}</h1>
                    <p className="text-xs text-muted-foreground">Somente consulta</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="CNPJ/CPF" value={supplier.cnpjCpf} />
                  <Field label="Contato" value={supplier.contato} />
                  <Field label="Cidade" value={supplier.cidade} />
                  <Field label="UF" value={supplier.uf} />
                  <Field label="E-mail" value={supplier.email} />
                  <Field label="Atendente" value={supplier.atendente} />
                  <div className="sm:col-span-2">
                    <Field label="Endereço" value={supplier.endereco} />
                  </div>
                </div>

                {supplier.localizacaoLink && (
                  <a
                    href={supplier.localizacaoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <MapPin className="w-4 h-4" />
                    Ver localização
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
