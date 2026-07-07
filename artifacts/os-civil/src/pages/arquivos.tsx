import { useState, useEffect, useRef } from "react";
import { salvarArquivo } from "@/lib/supabase";
import {
  Folder, FolderPlus, File, Plus, Trash2, Upload,
  ChevronRight, FileText, Image as ImageIcon, Sheet, ArrowLeft,
  Link as LinkIcon, ExternalLink, Pencil, Cloud,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useUnit } from "@/contexts/unit-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─────────────── Types ─────────────── */

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

type LinkEntry = {
  id: number;
  unidade: string;
  nome: string;
  descricao: string | null;
  url: string;
  createdAt: string;
};

type LinkForm = {
  nome: string;
  descricao: string;
  url: string;
};

const emptyLink: LinkForm = { nome: "", descricao: "", url: "" };

/* ─────────────── Helpers ─────────────── */

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

function detectCloudIcon(url: string) {
  const u = url.toLowerCase();
  if (u.includes("drive.google")) return "Google Drive";
  if (u.includes("onedrive") || u.includes("1drv")) return "OneDrive";
  if (u.includes("dropbox")) return "Dropbox";
  if (u.includes("sharepoint") || u.includes("sharepoint.com")) return "SharePoint";
  if (u.includes("icloud")) return "iCloud";
  if (u.includes("mega.nz") || u.includes("mega.co")) return "MEGA";
  return "Link";
}

/* ─────────────── Main Component ─────────────── */

export default function Arquivos() {
  const { unit } = useUnit();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"arquivos" | "links">("arquivos");

  /* ── File state ── */
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [path, setPath] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: "Raiz" },
  ]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  /* ── Link state ── */
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linkDialog, setLinkDialog] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [linkForm, setLinkForm] = useState<LinkForm>(emptyLink);
  const [savingLink, setSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);

  /* ────────────── File functions ────────────── */

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

  /* ────────────── Link functions ────────────── */

  const fetchLinks = async () => {
    setLinksLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/links?unidade=${unit}`);
      if (res.ok) setLinks(await res.json());
    } catch {
      toast({ title: "Erro ao carregar links", variant: "destructive" });
    } finally {
      setLinksLoading(false);
    }
  };

  useEffect(() => { fetchLinks(); }, [unit]);

  const openNewLink = () => {
    setEditingLinkId(null);
    setLinkForm(emptyLink);
    setLinkDialog(true);
  };

  const openEditLink = (l: LinkEntry) => {
    setEditingLinkId(l.id);
    setLinkForm({ nome: l.nome, descricao: l.descricao ?? "", url: l.url });
    setLinkDialog(true);
  };

  const handleSaveLink = async () => {
    if (!linkForm.nome.trim() || !linkForm.url.trim()) {
      toast({ title: "Nome e URL são obrigatórios", variant: "destructive" });
      return;
    }
    setSavingLink(true);
    try {
      const endpoint = editingLinkId
        ? `${BASE_URL}/api/links/${editingLinkId}`
        : `${BASE_URL}/api/links`;
      const method = editingLinkId ? "PATCH" : "POST";
      const res = await fetch(endpoint as string, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidade: unit,
          nome: linkForm.nome.trim(),
          descricao: linkForm.descricao.trim() || null,
          url: linkForm.url.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: editingLinkId ? "Link atualizado!" : "Link cadastrado!" });
      setLinkDialog(false);
      fetchLinks();
    } catch {
      toast({ title: "Erro ao salvar link", variant: "destructive" });
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm("Excluir este link? Esta ação não pode ser desfeita.")) return;
    setDeletingLinkId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/links/${id}?unidade=${unit}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      toast({ title: "Link excluído" });
      fetchLinks();
    } catch {
      toast({ title: "Erro ao excluir link", variant: "destructive" });
    } finally {
      setDeletingLinkId(null);
    }
  };

  /* ────────────── Render ────────────── */

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      {/* Page header */}
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
            Documentos, relatórios e links da unidade <strong>{unit}</strong>.
          </p>
        </div>

        {/* Tab actions */}
        {tab === "arquivos" && (
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
        )}
        {tab === "links" && (
          <Button size="sm" onClick={openNewLink} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Novo Link
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("arquivos")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px",
            tab === "arquivos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Folder className="w-4 h-4" />
          Arquivos
        </button>
        <button
          onClick={() => setTab("links")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px",
            tab === "links"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Cloud className="w-4 h-4" />
          Links de Armazenamento
        </button>
      </div>

      {/* ── ARQUIVOS TAB ── */}
      {tab === "arquivos" && (
        <>
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
            Clique em uma pasta para navegar · Clique em um arquivo para baixar · Máximo de 10 MB por arquivo
          </p>
        </>
      )}

      {/* ── LINKS TAB ── */}
      {tab === "links" && (
        <>
          <Card className="bg-card border-border/50">
            <CardContent className="p-0 overflow-x-auto">
              {linksLoading ? (
                <div className="p-10 text-center text-muted-foreground">Carregando...</div>
              ) : links.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Cloud className="w-14 h-14 mx-auto text-muted-foreground/20" />
                  <p className="text-muted-foreground text-sm">
                    Nenhum link cadastrado. Clique em "Novo Link" para adicionar.
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Adicione links do Google Drive, OneDrive, Dropbox, SharePoint, iCloud, MEGA e outros.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">Nome</th>
                      <th className="text-left px-4 py-2.5 font-semibold hidden sm:table-cell">Serviço</th>
                      <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Descrição</th>
                      <th className="text-left px-4 py-2.5 font-semibold hidden lg:table-cell">Adicionado em</th>
                      <th className="w-[120px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {links.map(link => (
                      <tr key={link.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-4 py-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 hover:text-primary transition-colors group/linkname"
                            title={`Abrir: ${link.url}`}
                          >
                            <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium group-hover/linkname:underline underline-offset-2">{link.nome}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover/linkname:text-primary transition-colors" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {detectCloudIcon(link.url)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm max-w-[220px] truncate">
                          {link.descricao || <span className="italic text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {new Date(link.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary"
                              title="Abrir link"
                              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title="Editar"
                              onClick={() => openEditLink(link)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Excluir"
                              disabled={deletingLinkId === link.id}
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {links.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Clique no ícone <ExternalLink className="w-3 h-3 inline" /> para abrir o link · Passe o mouse sobre a linha para ver as ações
            </p>
          )}
        </>
      )}

      {/* ── Link Dialog ── */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="max-w-md dark bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-primary" />
              {editingLinkId ? "Editar Link" : "Novo Link de Armazenamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: Documentos Técnicos — Google Drive"
                value={linkForm.nome}
                onChange={e => setLinkForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={linkForm.url}
                onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
              />
              {linkForm.url && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Cloud className="w-3 h-3" />
                  Serviço detectado: <strong>{detectCloudIcon(linkForm.url)}</strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                placeholder="Descreva o conteúdo deste link..."
                className="min-h-[70px] resize-none"
                value={linkForm.descricao}
                onChange={e => setLinkForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="rounded-md bg-muted/40 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground/70">Serviços suportados:</p>
              <p>Google Drive · OneDrive · Dropbox · SharePoint · iCloud · MEGA · e outros serviços em nuvem</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveLink} disabled={savingLink || !linkForm.nome.trim() || !linkForm.url.trim()}>
              {savingLink ? "Salvando..." : (editingLinkId ? "Salvar alterações" : "Cadastrar Link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
