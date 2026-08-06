// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

const CACHE_NAME = 'wherewild-__BUILD_VERSION__';

// Routes served from cache (network-first, offline fallback).
const OFFLINE_ROUTES = ['/', '/upload', '/about', '/help', '/settings', '/acknowledgements'];

// Routes that must never be served from cache.
const NETWORK_ONLY_PREFIXES = ['/api/', '/search', '/maps', '/map', '/species/', '/status', '/dev'];

// Content-hashed static assets served cache-first forever.
const CACHE_FIRST_PREFIXES = ['/_expo/static/', '/assets/'];

// Basemap tile hosts cached client-side (cache-first). Stadia's terms cap
// client-side tile caching at 7 days, so the cache bucket rotates weekly —
// looking up a request always targets the current bucket, which structurally
// prevents ever serving an entry older than the cap (see stadiaCacheName()).
const TILE_CACHE_HOSTS = new Set(['tiles.stadiamaps.com']);
const TILE_CACHE_PREFIX = 'stadia-tiles-';
const TILE_CACHE_BUCKET_MS = 7 * 24 * 60 * 60 * 1000;

function stadiaCacheName() {
  return `${TILE_CACHE_PREFIX}${Math.floor(Date.now() / TILE_CACHE_BUCKET_MS)}`;
}

// Our own backend-served tile endpoints — terrain (elevation lift),
// satellite imagery, and GIS-variable heatmap overlays. Matched by path
// pattern rather than host (the backend can be same-origin or a separate
// domain depending on deployment — see data/apiShared.ts's BACKEND_BASE) and
// by full pattern rather than a bare prefix, so this only catches actual
// tile images, not adjacent metadata endpoints like
// /api/layers/{id}/tile-range/classes. No external ToS caps any of this
// data (it's all our own backend), so unlike Stadia's rotating bucket these
// caches are persistent.
const CACHEABLE_TILE_PATH_PATTERNS = [
  { name: 'wherewild-terrain-tiles', pattern: /\/api\/layers\/elevation\/terrain-tiles\/\d+\/\d+\/\d+\.png$/ },
  { name: 'wherewild-satellite-tiles', pattern: /\/api\/tiles\/satellite\/\d+\/\d+\/\d+\.jpg$/ },
  { name: 'wherewild-variable-tiles', pattern: /\/api\/(variables|layers)\/[^/]+\/tiles\/\d+\/\d+\/\d+\.png$/ },
];
const PERSISTENT_TILE_CACHE_NAMES = new Set(CACHEABLE_TILE_PATH_PATTERNS.map((p) => p.name));

function matchBackendTileCache(pathname) {
  const match = CACHEABLE_TILE_PATH_PATTERNS.find(({ pattern }) => pattern.test(pathname));
  return match ? match.name : null;
}

// Testing/debug override, flipped by the offline-fallback map UI's cache
// toggle button (see leafletOfflineLogic.partial.js /
// globeOfflineEvaluateFallback.partial.js) — in-memory only, reset on every
// SW (re)start, and never changes real end-user behavior on its own.
let tileCacheFallbackDisabledForTesting = false;
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'setTileCacheFallbackDisabled') {
    tileCacheFallbackDisabledForTesting = !!event.data.disabled;
  }
});

// `cache: 'no-store'` forces every request to actually hit the network —
// otherwise a plain fetch() can silently resolve from the browser's own HTTP
// cache (separate from the Cache Storage here) with zero network attempt,
// which is indistinguishable from "online" even when offline.
//
// fallbackOnOffline=true means an area the user has already browsed while
// online (which populated the cache as a side effect) stays usable offline
// afterward — a deliberate "preload by browsing it first" pattern, not
// incidental staleness: nothing is ever served from cache while a real
// network path is available, only once the network fetch actually fails.
async function cachedTileResponse(request, cacheName, fallbackOnOffline) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    // Cross-origin tile <img> loads are typically opaque (status 0,
    // unreadable body) — they're still cacheable as opaque responses, just
    // not inspectable.
    if (response.ok || response.type === 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (fallbackOnOffline && !tileCacheFallbackDisabledForTesting) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    throw err;
  }
}

self.addEventListener('install', (event) => {
  // Pre-cache the offline-capable route shells.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ROUTES)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('wherewild-') &&
                  key !== CACHE_NAME &&
                  !PERSISTENT_TILE_CACHE_NAMES.has(key)) ||
                (key.startsWith(TILE_CACHE_PREFIX) && key !== stadiaCacheName()),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const { pathname } = url;

  // Our own backend's tile endpoints (terrain/satellite/variable overlays):
  // matched by path pattern (the backend can be same- or cross-origin
  // depending on deployment), network-first with cache fallback on failure —
  // checked before the origin/NETWORK_ONLY_PREFIXES handling below, since
  // those would otherwise bypass the SW entirely for this request
  // (same-origin /api/ is network-only, cross-origin non-tile hosts are
  // ignored outright).
  const backendTileCacheName = matchBackendTileCache(pathname);
  if (backendTileCacheName) {
    event.respondWith(cachedTileResponse(request, backendTileCacheName, true));
    return;
  }

  // Basemap tiles: network-first across origins, capped to a rolling weekly
  // cache bucket (see stadiaCacheName), with cache fallback on failure — an
  // area browsed while online stays usable offline afterward.
  if (TILE_CACHE_HOSTS.has(url.hostname)) {
    event.respondWith(cachedTileResponse(request, stadiaCacheName(), true));
    return;
  }

  // Different origin — let the browser handle it.
  if (url.origin !== self.location.origin) return;

  // Network-only: API calls and data-driven pages.
  if (NETWORK_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return;
  }

  // Cache-first: content-hashed JS/CSS bundles and static assets.
  if (CACHE_FIRST_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Network-first for offline routes: try network, fall back to cache.
  if (OFFLINE_ROUTES.includes(pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }
});
