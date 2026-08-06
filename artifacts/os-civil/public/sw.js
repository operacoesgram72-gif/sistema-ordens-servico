/**
 * Service Worker — GRAM Operações
 *
 * Estratégia de cache por tipo de recurso:
 *  • API (/api/*)          → sempre via rede, nunca cacheado
 *  • Navegação HTML        → rede primeiro; fallback para app shell em cache
 *  • Todos os demais GETs  → stale-while-revalidate com ignoreSearch=true
 *
 * O ignoreSearch=true garante que os módulos JS do Vite dev mode (que levam
 * timestamps como ?t=1234) sejam encontrados no cache mesmo quando o
 * timestamp muda. Isso habilita o modo offline em dev e em produção.
 */

const CACHE_NAME = "gram-operacoes-v3";

// Páginas do app shell pré-cacheadas na instalação do SW.
// Inclui rotas do portal do funcionário para que funcionem offline
// mesmo na primeira visita offline (após pelo menos uma visita online).
const PRECACHE_ASSETS = [
  "/",
  "/registrar",
  "/fechar-os",
  "/manifest.json",
  "/logo-amazonica.png",
  "/favicon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ── Instalação: pré-cachea o app shell ────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Ativação: remove caches de versões anteriores ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia em camadas ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Só intercepta GETs da mesma origem
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // ── API: sempre via rede — sem cache ──────────────────────────────────
  if (url.pathname.startsWith("/api/")) return;

  // ── Navegação HTML: rede primeiro, app shell como fallback ────────────
  // O React Router trata o roteamento no cliente, então servir o shell "/"
  // para qualquer rota offline é suficiente para carregar o app completo.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match("/").then(
            (cached) =>
              cached ||
              new Response("Aplicativo offline", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              })
          )
        )
    );
    return;
  }

  // ── Todos os outros GETs: stale-while-revalidate ──────────────────────
  // Serve do cache imediatamente (se disponível) e atualiza em background.
  //
  // ignoreSearch: true → módulos JS do Vite dev mode carregam com
  // timestamps (?t=123456) que mudam a cada restart. Ignorar o query
  // string garante que o cache seja encontrado offline mesmo com URLs
  // ligeiramente diferentes, habilitando o modo offline em dev e produção.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request, { ignoreSearch: true }).then((cached) => {
        // Sempre buscamos na rede para manter o cache atualizado
        const revalidate = fetch(event.request)
          .then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => null); // rede indisponível — usa cache

        if (cached) {
          // Responde com conteúdo cacheado imediatamente
          // e atualiza o cache em segundo plano
          event.waitUntil(revalidate);
          return cached;
        }

        // Cache vazio — aguarda a rede (primeira visita precisa ser online)
        return revalidate.then(
          (res) =>
            res ||
            new Response("", {
              status: 503,
              statusText: "Service Unavailable",
            })
        );
      });
    })
  );
});
