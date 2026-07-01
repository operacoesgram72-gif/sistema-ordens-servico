import { useState, useEffect, useRef } from "react";
import { salvarArquivo } from "@/lib/supabase";
import {
  Folder, FolderPlus, File, Plus, Trash2, Upload,
  ChevronRight, FileText, Image as ImageIcon, Sheet, ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnit } from "@/contexts/unit-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type FileEntry = {
  id: number;
  unidade: string;
  parentId: number | null;
  name: string;
  isFolder: number;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
};

function getFileIcon(entry: FileEntry) {
  if (entry.isFolder) return <Folder className="w-5 h-5 text-yellow-400 shrink-0" />;
  const t = entry.fileType || "";
  if (t.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />;
  if (t === "application/pdf") return <FileText className="w-5 h-5 text-red-400 shrink-0" />;
  if (t.includes("spreadsheet") || t.includes("excel") || t.includes("csv"))
    return <Sheet className="w-5 h-5 text-emerald-400 shrink-0" />;
  if (t.includes("word") || t.includes("document"))
    return <FileText className="w-5 h-5 text-blue-300 shrink-0" />;
  return <File className="w-5 h-5 text-muted-foreground shrink-0" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Arquivos() {
  const { unit } = useUnit();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [path, setPath] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: "Raiz" },
  ]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ unidade: unit });
      params.set("parentId", currentFolder === null ? "root" : String(currentFolder));
      const res = await fetch(`${BASE_URL}/api/file-entries?${params}`);
      if (res.ok) setEntries(await res.json());
    } catch {
      toast({ title: "Erro ao carregar arquivos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [currentFolder, unit]);

  const navigateTo = (id: number | null, name: string) => {
    if (id === null) {
      setPath([{ id: null, name: "Raiz" }]);
    } else {
      const idx = path.findIndex(p => p.id === id);
      if (idx >= 0) setPath(path.slice(0, idx + 1));
      else setPath([...path, { id, name }]);
    }
    setCurrentFolder(id);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`${BASE_URL}/api/file-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidade: unit, parentId: currentFolder, name: newFolderName.trim(), isFolder: 1 }),
      });
      if (!res.ok) throw new Error();
      salvarArquivo({ unidade: unit, parentId: currentFolder ?? undefined, name: newFolderName.trim(), isFolder: 1 });
      setNewFolderName("");
      setShowNewFolder(false);
      fetchEntries();
      toast({ title: "Pasta criada!" });
    } catch {
      toast({ title: "Erro ao criar pasta", variant: "destructive" });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} muito grande (máx 10 MB)`, variant: "destructive" });
        continue;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          await fetch(`${BASE_URL}/api/file-entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unidade: unit,
              parentId: currentFolder,
              name: file.name,
              isFolder: 0,
              fileData: reader.result,
              fileType: file.type,
              fileSize: file.size,
            }),
          });
          salvarArquivo({ unidade: unit, parentId: currentFolder ?? undefined, name: file.name, isFolder: 0, fileType: file.type, fileSize: file.size });
          fetchEntries();
          toast({ title: `${file.name} enviado!` });
        } catch {
          toast({ title: `Erro ao enviar ${file.name}`, variant: "destructive" });
        }
      };
    }
    e.target.value = "";
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Excluir "${entry.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await fetch(`${BASE_URL}/api/file-entries/${entry.id}`, { method: "DELETE" });
      fetchEntries();
      toast({ title: "Excluído com sucesso" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleDownload = (entry: FileEntry) => {
    window.open(`${BASE_URL}/api/file-entries/${entry.id}/download`, "_blank");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Folder className="w-7 h-7 text-primary" />
            Gestão de Arquivos
          </h1>
          <p className="text-muted-foreground mt-1">
            Documentos, relatórios e arquivos da unidade <strong>{unit}</strong>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setShowNewFolder(v => !v); setNewFolderName(""); }} className="gap-2">
            <FolderPlus className="w-4 h-4" />
            Nova Pasta
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar" />
        </div>
      </div>

      {showNewFolder && (
        <div className="flex items-center gap-2 max-w-sm">
          <Input
            placeholder="Nome da nova pasta..."
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
            autoFocus
          />
          <Button size="sm" onClick={createFolder}><Plus className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>✕</Button>
        </div>
      )}

      <nav className="flex items-center gap-1 text-sm flex-wrap">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            <button
              onClick={() => navigateTo(p.id, p.name)}
              className={cn(
                "transition-colors",
                i === path.length - 1
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              {p.name}
            </button>
          </span>
        ))}
      </nav>

      <Card className="bg-card border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Folder className="w-14 h-14 mx-auto text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">
                Pasta vazia. Crie uma pasta ou faça upload de arquivos.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-semibold">Nome</th>
                  <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Tipo</th>
                  <th className="text-right px-4 py-2.5 font-semibold hidden md:table-cell">Tamanho</th>
                  <th className="text-right px-4 py-2.5 font-semibold hidden sm:table-cell">Data</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => entry.isFolder ? navigateTo(entry.id, entry.name) : handleDownload(entry)}
                        className="flex items-center gap-2.5 hover:text-primary transition-colors text-left"
                      >
                        {getFileIcon(entry)}
                        <span className={cn("font-medium", entry.isFolder && "text-foreground")}>{entry.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                      {entry.isFolder ? "Pasta" : (entry.fileType?.split("/")[1]?.toUpperCase() || "Arquivo")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden md:table-cell font-mono text-xs">
                      {entry.isFolder ? "—" : formatSize(entry.fileSize)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden sm:table-cell">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleDelete(entry)}
                        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        💡 Clique em uma pasta para navegar · Clique em um arquivo para baixar · Máximo de 10 MB por arquivo
      </p>
    </div>
  );
}
