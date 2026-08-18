    // Offline/online detection, ported from SpeciesOccurrenceMap.html's
    // evaluateOfflineFallback: track basemap tile fetch failures per load
    // cycle, plus the browser's online/offline signal, and toggle the
    // offlineFallback-layer (added above) visible/hidden accordingly.
    if (ENABLE_OFFLINE_FALLBACK) {
      var basemapTileErrorsThisCycle = 0;
      var basemapTilesConfirmedLoaded = false;
      var shouldShowFallback = false;
      function evaluateOfflineFallback() {
        var isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
        shouldShowFallback = !isOnline || !basemapTilesConfirmedLoaded;
        if (map.getLayer('offlineFallback-layer')) {
          map.setLayoutProperty('offlineFallback-layer', 'visibility', shouldShowFallback ? 'visible' : 'none');
        }
        if (map.getLayer('offlinePlaceLabels-layer')) {
          map.setLayoutProperty('offlinePlaceLabels-layer', 'visibility', shouldShowFallback ? 'visible' : 'none');
        }
        // Deliberately NOT hiding basemap-layer itself here: basemapTilesConfirmedLoaded
        // is an all-or-nothing signal for the whole viewport's tile batch —
        // a single missing tile at the edge of the pan would flip
        // shouldShowFallback true and hide every OTHER tile in view too,
        // including ones that genuinely loaded fine from cache. Relying on
        // z-order (offlineFallback-layer sits below basemap-layer) instead:
        // real/cached tiles still show through per-tile wherever they
        // succeed, and the vector background only fills the gaps.
        // (maxTileCacheSize was previously forced to 0 map-wide — removed
        // after it turned out to cause an unrelated endless tile-refetch
        // loop under 3D terrain; this offline-detection logic no longer
        // depends on it, so it should keep working the same, but hasn't
        // been separately re-verified against MapLibre's default cache.)
        if (cacheToggleBtn) { cacheToggleBtn.style.display = shouldShowFallback ? 'flex' : 'none'; }
      }
      map.on('dataloading', function(e) {
        if (e && e.sourceId === 'basemap') { basemapTileErrorsThisCycle = 0; }
      });
      map.on('error', function(e) {
        if (e && e.sourceId === 'basemap') {
          basemapTileErrorsThisCycle += 1;
          evaluateOfflineFallback();
        }
      });
      map.on('sourcedata', function(e) {
        if (e && e.sourceId === 'basemap' && e.isSourceLoaded) {
          basemapTilesConfirmedLoaded = basemapTileErrorsThisCycle === 0;
          evaluateOfflineFallback();
        }
      });
      if (typeof window !== 'undefined') {
        window.addEventListener('online', evaluateOfflineFallback);
        window.addEventListener('offline', evaluateOfflineFallback);
      }

      // Testing/debug toggle for tile caching. There's no service worker
      // involved (a service worker can't reliably intercept fetches from
      // inside a srcdoc iframe in any current browser — see
      // https://github.com/w3c/ServiceWorker/issues/1390) — MapLibre's own
      // fetch()-based tile requests are already served from the browser's
      // native HTTP cache (governed by the tile responses' Cache-Control
      // headers), which is what makes previously-browsed areas work offline
      // here. This toggle controls that directly, the same way as the
      // Leaflet template: disabling it re-points the basemap source at a
      // cache-busted tile URL (via setTiles), forcing genuine network
      // fetches that bypass the browser cache entirely — so it fails while
      // offline even for a previously-cached tile, instead of relying on
      // whatever the browser happens to still have. Injected (via
      // sendPinMessageAnchor, see regenerate-offline-map-templates.mjs)
      // after all of the template's other addControl calls, so this
      // naturally lands last in the top-right stack without needing to
      // defer it.
      var cacheFallbackDisabled = false;
      var CACHE_TOGGLE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2v-9"/><path d="M2.5 8c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2"/></svg>';
      function setCacheFallbackDisabled(disabled) {
        cacheFallbackDisabled = disabled;
        var baseUrl = tileUrlForBasemapMode(currentBasemapMode);
        var url = disabled
          ? baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + '_nocache=' + Date.now()
          : baseUrl;
        var basemapSource = map.getSource('basemap');
        if (basemapSource) { basemapSource.setTiles([url]); }
        // Explicitly hidden only while cache is disabled — not tied to
        // shouldShowFallback, which is an all-or-nothing signal for the
        // whole viewport's tile batch and would hide genuinely-cached tiles
        // right alongside missing ones. With cache disabled, every tile
        // request is forced fresh (see the cache-busted url above) and thus
        // fails while offline, so hiding basemap-layer here just cleanly
        // shows "nothing cached" instead of letting MapLibre's overzoom
        // placeholder behavior (reusing whatever stale tile it still has on
        // hand) blur the demonstration.
        if (map.getLayer('basemap-layer')) {
          map.setLayoutProperty('basemap-layer', 'visibility', disabled ? 'none' : 'visible');
        }
      }
      // Only visible while the fallback UI itself is showing (i.e. offline)
      // — hidden the rest of the time so it doesn't clutter the controls
      // for regular online use. Display toggling happens in
      // evaluateOfflineFallback above via cacheToggleBtn.
      var cacheToggleBtn = null;
      if (!window.ReactNativeWebView) {
        map.addControl({
          onAdd: function() {
            var container = document.createElement('div');
            container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;';
            btn.style.display = shouldShowFallback ? 'flex' : 'none';
            var updateButton = function() {
              btn.title = cacheFallbackDisabled
                ? 'Offline tile cache disabled for testing — click to re-enable'
                : 'Offline tile cache enabled — click to disable for testing';
              btn.style.color = cacheFallbackDisabled ? '' : palette.linkColor;
            };
            btn.innerHTML = CACHE_TOGGLE_ICON;
            updateButton();
            btn.addEventListener('click', function() {
              setCacheFallbackDisabled(!cacheFallbackDisabled);
              updateButton();
            });
            container.appendChild(btn);
            cacheToggleBtn = btn;
            return container;
          },
          onRemove: function() {},
        });
      }
    }
