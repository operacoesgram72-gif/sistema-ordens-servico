import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ClipboardList, Truck, Users, Package } from "lucide-react";
import { useLocation } from "wouter";
import { useUnit } from "@/contexts/unit-context";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type SearchResult = {
  id: number;
  type: "os" | "supplier" | "tech" | "material";
  title: string;
  subtitle?: string | null;
  status?: string | null;
  unidade?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  os: "OS",
  supplier: "Fornecedor",
  tech: "Técnico",
  material: "Material",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  os: ClipboardList,
  supplier: Truck,
  tech: Users,
  material: Package,
};

function getHref(r: SearchResult): string {
  if (r.type === "os") return `/ordens/${r.id}`;
  if (r.type === "supplier") return `/fornecedores`;
  if (r.type === "tech") return `/tecnicos`;
  return `/retirada-materiais`;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { unit } = useUnit();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${BASE_URL}/api/search?q=${encodeURIComponent(query.trim())}&unidade=${unit}`
        );
        if (res.ok) setResults(await res.json());
      } catch {
        // silently ignore network errors
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, unit, open]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  }, []);

  const handleSelect = (r: SearchResult) => {
    setLocation(getHref(r));
    handleClose();
  };

  const showDropdown = open && query.trim().length >= 2 && (loading || searched);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-border/40 bg-muted/20 text-muted-foreground text-sm hover:bg-muted/50 hover:text-foreground transition-colors group"
        title="Pesquisa global — OS, técnicos, fornecedores, materiais"
        aria-label="Abrir pesquisa global"
      >
        <Search className="w-3.5 h-3.5 shrink-0 group-hover:text-primary transition-colors" />
        <span className="truncate text-xs">Pesquisar...</span>
        <kbd className="ml-auto text-[9px] font-mono text-muted-foreground/50 hidden xl:inline-flex border border-border/40 rounded px-1">
          /
        </kbd>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/50 bg-background ring-1 ring-primary/20">
        <Search className="w-3.5 h-3.5 text-primary shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="OS, técnicos, fornecedores, materiais..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground min-w-0"
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClose();
          }}
        />
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded transition-colors"
          aria-label="Fechar pesquisa"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-md shadow-xl z-[200] overflow-hidden">
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Buscando…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Nenhum resultado para <strong>"{query}"</strong>.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
              {results.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? Search;
                return (
                  <li key={`${r.type}-${r.id}`} role="option">
                    <button
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate leading-tight">
                          {r.title}
                        </div>
                        {r.subtitle && (
                          <div className="text-xs text-muted-foreground truncate leading-tight">
                            {r.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {TYPE_LABELS[r.type]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
