          ENABLE_OFFLINE_FALLBACK ? { offlineFallback: { type: 'raster', tiles: ['offlinebasemap://{z}/{x}/{y}'], tileSize: 256, maxzoom: TILE_MAX_ZOOM } } : {},
          ENABLE_OFFLINE_FALLBACK ? { offlinePlaceLabels: { type: 'geojson', data: PLACE_LABELS_GEOJSON } } : {}
