          // offlineFallback-layer itself is added directly in the main
          // template's base layers array (see SpeciesOccurrenceGlobeMap.html)
          // so it can sit below basemap-layer — a plain .concat() here would
          // only ever be able to append after it.
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
              // Only font actually hosted at the demotiles glyphs endpoint (see the glyphs: line above the sources).
              'text-font': ['Noto Sans Regular'],
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
