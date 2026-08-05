    // Offline/online detection, ported from SpeciesOccurrenceMap.html's
    // evaluateOfflineFallback: track basemap tile fetch failures per load
    // cycle, plus the browser's online/offline signal, and toggle the
    // offlineFallback-layer (added above) visible/hidden accordingly.
    if (ENABLE_OFFLINE_FALLBACK) {
      var basemapTileErrorsThisCycle = 0;
      var basemapTilesConfirmedLoaded = false;
      function evaluateOfflineFallback() {
        var isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
        var shouldShowFallback = !isOnline || !basemapTilesConfirmedLoaded;
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
    }
