    // ---- offline vector basemap fallback, ported from SpeciesOccurrenceMap.html's
    // NaturalEarthCanvasLayer. Same embedded Natural Earth data (land, water,
    // boundaries, roads, rail, glaciers) and the same Path2D fill/stroke drawing
    // algorithm, but packaged as a MapLibre custom raster protocol (same pattern
    // as the heatmap:// protocol above) instead of a Leaflet GridLayer, so it
    // works under globe projection too.
    if (ENABLE_OFFLINE_FALLBACK) {
      var OFFLINE_FALLBACK_PALETTE = MAP_TILE_MODE === 'dark' ? {
        land: '#333333',
        water: '#222222',
        urban: 'rgba(210,210,205,0.07)',
        boundary: 'rgba(230,199,206,0.35)',
        glacier: 'rgba(191,191,191,0.55)',
        road: 'rgba(130,130,130,0.8)',
        rail: 'rgba(150,150,150,0.6)',
        labelText: '#9aa2ac',
        labelHalo: '#333333',
      } : {
        land: '#f2f3f0',
        water: '#c1c9cc',
        urban: '#eeece5',
        boundary: '#e6cccf',
        glacier: '#f7f7f7',
        road: '#d5d5d5',
        rail: '#dddddd',
        labelText: '#758191',
        labelHalo: '#f2f3f0',
      };

      var OFFLINE_CANVAS_LAYERS = [
        { data: CANVAS_WORLD_BOUNDARIES, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.land, strokeStyle: OFFLINE_FALLBACK_PALETTE.boundary, lineWidth: 1 };
        } },
        { data: CANVAS_MINOR_ISLANDS, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.land, strokeStyle: OFFLINE_FALLBACK_PALETTE.boundary, lineWidth: 0.5 };
        } },
        { data: CANVAS_URBAN_AREAS, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.urban };
        } },
        { data: CANVAS_GLACIATED_AREAS, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.glacier, alpha: 0.85 };
        } },
        { data: CANVAS_ADMIN1_BOUNDARIES, kind: 'stroke', style: function() {
          return { strokeStyle: OFFLINE_FALLBACK_PALETTE.boundary, lineWidth: 0.5 };
        } },
        { data: CANVAS_LAKES, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.water, strokeStyle: OFFLINE_FALLBACK_PALETTE.water, lineWidth: 0.5 };
        } },
        { data: CANVAS_PLAYAS, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.land, strokeStyle: OFFLINE_FALLBACK_PALETTE.boundary, lineWidth: 0.5, alpha: 0.6 };
        } },
        { data: CANVAS_ANTARCTIC_ICE_SHELVES, kind: 'fill', style: function() {
          return { fillStyle: OFFLINE_FALLBACK_PALETTE.glacier, alpha: 0.9 };
        } },
        { data: CANVAS_REEFS, kind: 'stroke', style: function() {
          return { strokeStyle: OFFLINE_FALLBACK_PALETTE.water, lineWidth: 1 };
        } },
        { data: CANVAS_RIVERS, kind: 'stroke', style: function() {
          return { strokeStyle: OFFLINE_FALLBACK_PALETTE.water, lineWidth: 0.75 };
        } },
        { data: CANVAS_ROADS, kind: 'stroke', style: function() {
          return { strokeStyle: OFFLINE_FALLBACK_PALETTE.road, lineWidth: 0.75 };
        } },
      ];

      // Same tile math as NaturalEarthCanvasLayer.createTile: coordinates are
      // pre-projected to normalized Web Mercator [0,1] space at build time, so
      // this is just a translate+scale into the tile's pixel space, no per-tile
      // projection math needed.
      function drawOfflineBasemapTile(ctx, z, x, y, size) {
        var N = Math.pow(2, z);
        var tileMinX = x / N, tileMaxX = (x + 1) / N;
        var tileMinY = y / N, tileMaxY = (y + 1) / N;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.fillStyle = OFFLINE_FALLBACK_PALETTE.water;
        ctx.fillRect(0, 0, size, size);
        OFFLINE_CANVAS_LAYERS.forEach(function(layerDef) {
          var style = layerDef.style();
          var path = new Path2D();
          var hasAny = false;
          layerDef.data.forEach(function(part) {
            var bbox = part[0], zLevel = part[1], rings = part[2], closed = part[3];
            if (zLevel != null && z < zLevel) { return; }
            if (bbox[0] > tileMaxX || bbox[2] < tileMinX || bbox[1] > tileMaxY || bbox[3] < tileMinY) { return; }
            hasAny = true;
            rings.forEach(function(ring) {
              for (var i = 0; i < ring.length; i += 2) {
                var px = (ring[i] * N - x) * size;
                var py = (ring[i + 1] * N - y) * size;
                if (i === 0) { path.moveTo(px, py); } else { path.lineTo(px, py); }
              }
              if (closed) { path.closePath(); }
            });
          });
          if (!hasAny) { return; }
          ctx.globalAlpha = style.alpha != null ? style.alpha : 1;
          if (layerDef.kind === 'fill') {
            ctx.fillStyle = style.fillStyle;
            ctx.fill(path);
          }
          if (style.strokeStyle) {
            ctx.strokeStyle = style.strokeStyle;
            ctx.lineWidth = style.lineWidth || 1;
            ctx.setLineDash(style.dash || []);
            ctx.stroke(path);
            ctx.setLineDash([]);
          }
        });
        ctx.globalAlpha = 1;
      }

      var OFFLINE_TILE_URL_RE = /^offlinebasemap:\/\/(\d+)\/(-?\d+)\/(-?\d+)/;
      if (typeof maplibregl.addProtocol === 'function') {
        maplibregl.addProtocol('offlinebasemap', function(params) {
          var match = OFFLINE_TILE_URL_RE.exec(params.url);
          if (!match) {
            return Promise.reject(new Error('Bad offline basemap tile URL: ' + params.url));
          }
          var z = Number(match[1]), x = Number(match[2]), y = Number(match[3]);
          var size = 256;
          var useOffscreen = typeof OffscreenCanvas !== 'undefined';
          var canvas = useOffscreen ? new OffscreenCanvas(size, size) : document.createElement('canvas');
          if (!useOffscreen) { canvas.width = size; canvas.height = size; }
          var ctx = canvas.getContext('2d');
          drawOfflineBasemapTile(ctx, z, x, y, size);
          if (useOffscreen) {
            return canvas.convertToBlob({ type: 'image/png' }).then(function(blob) {
              return blob.arrayBuffer();
            }).then(function(data) { return { data: data }; });
          }
          return new Promise(function(resolve, reject) {
            canvas.toBlob(function(blob) {
              if (!blob) { reject(new Error('Failed to encode offline basemap tile')); return; }
              blob.arrayBuffer().then(function(data) { resolve({ data: data }); });
            }, 'image/png');
          });
        });
      }
    }
