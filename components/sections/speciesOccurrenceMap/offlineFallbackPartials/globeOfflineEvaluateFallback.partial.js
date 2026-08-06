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

      // Testing/debug toggle for the SW's tile cache fallback (see
      // public/sw.js's cachedTileResponse) — shown whenever this offline-
      // capable template is loaded at all (independent of shouldShowFallback,
      // which only tracks the Natural Earth vector background specifically),
      // so it's available for verifying whether tiles you already browsed
      // while online are actually being served from cache now vs. genuinely
      // failing. Disabling it here does not affect real end users; it only
      // flips a same-origin in-memory flag the SW checks before falling back
      // to cache on a failed fetch — toggling it back on (or reloading)
      // restores normal behavior. Injected (via sendPinMessageAnchor, see
      // regenerate-offline-map-templates.mjs) after all of the template's
      // other addControl calls, so this naturally lands last in the
      // top-right stack without needing to defer it.
      var cacheFallbackDisabled = false;
      var CACHE_TOGGLE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2v-9"/><path d="M2.5 8c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2"/></svg>';
      function setCacheFallbackDisabled(disabled) {
        cacheFallbackDisabled = disabled;
        if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'setTileCacheFallbackDisabled', disabled: disabled });
        }
      }
      if (!window.ReactNativeWebView) {
        map.addControl({
          onAdd: function() {
            var container = document.createElement('div');
            container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;';
            var updateButton = function() {
              btn.title = cacheFallbackDisabled
                ? 'Offline tile cache disabled for testing — click to re-enable'
                : 'Offline tile cache enabled — click to disable for testing';
              btn.style.color = cacheFallbackDisabled ? palette.linkColor : '';
            };
            btn.innerHTML = CACHE_TOGGLE_ICON;
            updateButton();
            btn.addEventListener('click', function() {
              setCacheFallbackDisabled(!cacheFallbackDisabled);
              updateButton();
            });
            container.appendChild(btn);
            return container;
          },
          onRemove: function() {},
        });
      }
    }
