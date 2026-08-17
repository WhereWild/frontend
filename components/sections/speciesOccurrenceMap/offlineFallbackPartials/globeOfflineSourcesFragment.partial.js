          // Natural Earth is public domain and doesn't legally require
          // attribution, but GeoNames (used for the offline populated-places
          // labels below) is CC-BY — this is a real license requirement, not
          // courtesy. Attributed on the sources themselves (not a second,
          // always-on AttributionControl) so the single control the main
          // template already adds aggregates it automatically, same as
          // every other source.
          ENABLE_OFFLINE_FALLBACK ? { offlineFallback: { type: 'raster', tiles: ['offlinebasemap://{z}/{x}/{y}'], tileSize: 256, maxzoom: TILE_MAX_ZOOM, attribution: '<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>' } } : {},
          ENABLE_OFFLINE_FALLBACK ? { offlinePlaceLabels: { type: 'geojson', data: PLACE_LABELS_GEOJSON, attribution: '<a href="https://www.geonames.org/" target="_blank">GeoNames</a>' } } : {}
