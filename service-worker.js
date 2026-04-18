// service-worker.js — Potager Magique
// Précache assets statiques + stale-while-revalidate pour Open-Meteo

const CACHE_VERSION = 'pm-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.css',
  '/alertes.css',
  '/pousses.css',
  '/compagnonnage.css',
  '/manifest.json',
  '/meteo.js',
  '/dashboard.js',
  '/cultures.js',
  '/cultures-ui.js',
  '/parametres-ui.js',
  '/alertes.js',
  '/alertes-ui.js',
  '/expert.js',
  '/dashboard-ui.js',
  '/expert-rules.json',
  '/pousses.js',
  '/pousses-data.json',
  '/pousses-ui.js',
  '/compagnonnage.js',
  '/compagnonnage-data.json',
  // Les assets WebP assets/pousses/ sont cachés au premier accès via cacheFirst (NFR6)
];

const METEO_ORIGIN = 'api.open-meteo.com';

// ─── INSTALL : précache assets statiques ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE : nettoie les anciennes versions de cache ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH : stale-while-revalidate (Open-Meteo) + cache-first (assets) ───
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET et les requêtes chrome-extension
  if (event.request.method !== 'GET') return;
  try {
    const url = new URL(event.request.url);
    if (url.hostname === METEO_ORIGIN) {
      event.respondWith(staleWhileRevalidate(event.request));
    } else {
      event.respondWith(cacheFirst(event.request));
    }
  } catch {
    // URL non parsable — laisser passer
  }
});

// Stratégie stale-while-revalidate : répond immédiatement avec le cache,
// met à jour le cache en arrière-plan (NFR14 — ≤1 appel/h géré par meteo.js)
async function staleWhileRevalidate(request) {
  const cache    = await caches.open(CACHE_VERSION);
  const cached   = await cache.match(request);
  const networkP = fetch(request)
    .then(res => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || await networkP || new Response('Offline', { status: 503 });
}

// Stratégie cache-first : sert depuis le cache, fetch en fallback
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
