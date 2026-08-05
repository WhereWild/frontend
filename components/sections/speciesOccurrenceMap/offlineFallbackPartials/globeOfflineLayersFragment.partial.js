          // Sits directly above the real basemap so it visually replaces it
          // while shown; shown-by-default until a clean tile load says
          // otherwise, matching the Leaflet fallback's default (see
          // evaluateOfflineFallback below).
          .concat(ENABLE_OFFLINE_FALLBACK ? [{ id: 'offlineFallback-layer', type: 'raster', source: 'offlineFallback', layout: { visibility: 'visible' } }] : [])
          // Place-name labels: MapLibre's own symbol collision system does
          // the decluttering (viewport culling + priority-based overlap
          // avoidance, globe-occlusion-aware) that the Leaflet fallback has
          // to hand-roll with a spatial grid — symbol-sort-key expresses the
          // same per-feature z priority (lower z = more important = wins
          // collisions) the Leaflet template uses, and the zoom filter below
          // is the same "eligible once zoom >= z" rule.
          .concat(ENABLE_OFFLINE_FALLBACK ? [{
            id: 'offlinePlaceLabels-layer',
            type: 'symbol',
            source: 'offlinePlaceLabels',
            filter: ['<=', ['get', 'z'], ['zoom']],
            layout: {
              visibility: 'visible',
              'text-field': ['get', 'name'],
              'text-font': ['match', ['get', 'weight'], 'bold', ['literal', ['Open Sans Bold', 'Arial Unicode MS Bold']], ['literal', ['Open Sans Regular', 'Arial Unicode MS Regular']]],
              'text-size': ['match', ['get', 'weight'], 'bold', 12, 10],
              'symbol-sort-key': ['get', 'z'],
              'text-allow-overlap': false,
              'text-ignore-placement': false,
            },
            paint: {
              'text-color': OFFLINE_FALLBACK_PALETTE.labelText,
              'text-halo-color': OFFLINE_FALLBACK_PALETTE.labelHalo,
              'text-halo-width': 1,
            },
          }] : [])
