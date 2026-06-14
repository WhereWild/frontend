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
            .filter((key) => key.startsWith('wherewild-') && key !== CACHE_NAME)
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
