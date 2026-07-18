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

async function cachedTileResponse(request) {
  const cache = await caches.open(stadiaCacheName());
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Cross-origin tile <img> loads are typically opaque (status 0, unreadable
  // body) — they're still cacheable as opaque responses, just not inspectable.
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
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
                (key.startsWith('wherewild-') && key !== CACHE_NAME) ||
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

  // Basemap tiles: cache-first across origins, capped to a rolling weekly bucket.
  if (TILE_CACHE_HOSTS.has(url.hostname)) {
    event.respondWith(cachedTileResponse(request));
    return;
  }

  // Different origin — let the browser handle it.
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;

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
