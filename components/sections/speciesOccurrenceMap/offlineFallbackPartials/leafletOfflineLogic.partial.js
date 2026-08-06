    if (ENABLE_OFFLINE_FALLBACK) {
    // Palette approximated from Stadia's published Alidade Smooth / Alidade
    // Smooth Dark style JSON (background, water, boundary, highway, and
    // place-label colors), so this offline fallback reads as the same map
    // rather than a visibly different placeholder.
    var FALLBACK_PALETTE = MAP_TILE_MODE === 'dark' ? {
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
    // Ocean is just "no land polygon here" — match it to the same water
    // color used for lakes/rivers rather than a separate hardcoded blue.
    map.getContainer().style.background = FALLBACK_PALETTE.water;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    // Text-only place labels (no marker dot), lazily created/destroyed by
    // updateLabelDeclutter below — matches the lightweight look of minimal
    // offline basemaps (e.g. tinyworldmap), which is itself a canvas
    // GridLayer that only ever renders what's in the visible tile, plus a
    // hard cap on total city count. Plain Leaflet has no per-feature
    // viewport culling or label-collision detection out of the box (unlike
    // vector-tile renderers such as the Stadia style this fallback mimics),
    // so both of those have to be done by hand here: a feature only
    // becomes a real marker once it's both zoom-eligible (z <= current
    // zoom) AND within the current viewport, and even then only the
    // highest-priority MAX_VISIBLE_LABELS survive, so a dense cluster of
    // minor towns can't still blanket the screen once zoomed in enough for
    // all of them to individually qualify.
    var MAX_VISIBLE_LABELS = 150;
    // Spatial grid over all registered labels so a recompute only ever
    // touches entries actually near the current viewport, not the whole
    // dataset. This matters a lot now: GeoNames alone is 235k places, and
    // with the x3 world-copy duplication that's ~700k registered entries —
    // scanning all of them on every single pan/zoom event (the original,
    // pre-GeoNames-scale approach) is slow enough on a phone that rapid
    // interaction can queue up recomputes faster than they finish, which
    // reads as labels getting permanently stuck rather than what it
    // actually is: a stale pass that never caught up. The canvas layer
    // already gets this same benefit for free from per-tile bbox culling;
    // this gives the point/label system the equivalent.
    var GRID_CELL_DEG = 5;
    var labelGrid = {};
    var shownLabelEntries = new Set();
    function gridKey(lat, lon) {
      return Math.floor(lat / GRID_CELL_DEG) + ',' + Math.floor(lon / GRID_CELL_DEG);
    }
    function registerLabelEntry(lat, lon, z, name, fontSize, fontWeight) {
      var entry = {
        latlng: L.latLng(lat, lon),
        z: z,
        name: name,
        fontSize: fontSize,
        fontWeight: fontWeight,
        marker: null,
      };
      var key = gridKey(lat, lon);
      (labelGrid[key] = labelGrid[key] || []).push(entry);
    }
    function registerLabelDataset(geojson, fontSize, fontWeight) {
      WORLD_COPY_OFFSETS.forEach(function(offsetDeg) {
        geojson.features.forEach(function(f) {
          var name = f.properties && f.properties.name;
          if (!name) { return; }
          var z = (f.properties && f.properties.z != null) ? f.properties.z : 5;
          var coords = f.geometry.coordinates;
          registerLabelEntry(coords[1], coords[0] + offsetDeg, z, name, fontSize, fontWeight);
        });
      });
    }
    // Same as registerLabelDataset, but for a flat [lon,lat,name,z] array
    // instead of GeoJSON — GeoJSON's per-feature {"type":"Feature",
    // "properties":{...},"geometry":{...}} boilerplate would add ~18MB of
    // pure repeated overhead across GeoNames' 235k rows; a flat tuple array
    // avoids that entirely for a dataset this size.
    function registerCompactLabelDataset(rows, fontSize, fontWeight) {
      WORLD_COPY_OFFSETS.forEach(function(offsetDeg) {
        rows.forEach(function(row) {
          var lon = row[0], lat = row[1], name = row[2], z = row[3];
          if (!name) { return; }
          registerLabelEntry(lat, lon + offsetDeg, z != null ? z : 5, name, fontSize, fontWeight);
        });
      });
    }
    function makeLabelMarker(entry) {
      var halo = FALLBACK_PALETTE.labelHalo;
      var style = 'color:' + FALLBACK_PALETTE.labelText + ';font-size:' + entry.fontSize + 'px;'
        + 'font-weight:' + entry.fontWeight + ';white-space:nowrap;pointer-events:none;'
        + 'text-shadow:-1px -1px 0 ' + halo + ',1px -1px 0 ' + halo + ','
        + '-1px 1px 0 ' + halo + ',1px 1px 0 ' + halo + ';';
      return L.marker(entry.latlng, {
        pane: 'worldOutlineLabelsPane',
        interactive: false,
        icon: L.divIcon({
          className: 'world-outline-label',
          html: '<span style="' + style + '">' + escapeHtml(entry.name) + '</span>',
          iconSize: [0, 0],
          iconAnchor: [-4, 4],
        }),
      });
    }
    // Minimum on-screen spacing (px) between two accepted labels — a count
    // cap alone still lets a dense cluster of similarly-important places
    // (e.g. western Europe) all qualify and visually overlap each other.
    // Real label renderers (vector-tile symbol layers, and almost
    // certainly tiny-world-map's canvas renderer) do this same greedy
    // priority-order collision check, not just a raw count limit.
    var MIN_LABEL_SPACING_PX = 70;
    function updateLabelDeclutter() {
      if (!shouldShowFallback) { return; }
      var zoom = map.getZoom();
      var bounds = map.getBounds().pad(0.25);
      var candidates = [];
      var minLatCell = Math.floor(bounds.getSouth() / GRID_CELL_DEG);
      var maxLatCell = Math.floor(bounds.getNorth() / GRID_CELL_DEG);
      var minLonCell = Math.floor(bounds.getWest() / GRID_CELL_DEG);
      var maxLonCell = Math.floor(bounds.getEast() / GRID_CELL_DEG);
      for (var latCell = minLatCell; latCell <= maxLatCell; latCell++) {
        for (var lonCell = minLonCell; lonCell <= maxLonCell; lonCell++) {
          var bucket = labelGrid[latCell + ',' + lonCell];
          if (!bucket) { continue; }
          for (var b = 0; b < bucket.length; b++) {
            var candidate = bucket[b];
            if (zoom >= candidate.z && bounds.contains(candidate.latlng)) {
              candidates.push(candidate);
            }
          }
        }
      }
      // Already-visible labels get a small priority nudge, just enough to
      // win a genuine near-tie (same/adjacent z, borderline viewport edge,
      // borderline collision distance) so they don't flip accept/reject on
      // every recompute from sub-pixel differences alone. This must stay a
      // *nudge*, not an absolute override: an earlier version made
      // already-visible always beat not-yet-visible regardless of z, which
      // let a batch of very minor local labels that happened to be visible
      // during a deep zoom-in permanently squat on MAX_VISIBLE_LABELS —
      // genuinely important cities could never displace them again, even
      // zoomed back out to a view where they clearly should have won.
      var STICKY_BONUS = 0.5;
      candidates.sort(function(a, b) {
        var aKey = a.z - (a.marker ? STICKY_BONUS : 0);
        var bKey = b.z - (b.marker ? STICKY_BONUS : 0);
        return aKey - bKey;
      });

      var accepted = [];
      var acceptedPoints = [];
      var minSpacingSq = MIN_LABEL_SPACING_PX * MIN_LABEL_SPACING_PX;
      for (var i = 0; i < candidates.length && accepted.length < MAX_VISIBLE_LABELS; i++) {
        var entry = candidates[i];
        var point = map.latLngToContainerPoint(entry.latlng);
        var tooClose = false;
        for (var j = 0; j < acceptedPoints.length; j++) {
          var dx = point.x - acceptedPoints[j].x;
          var dy = point.y - acceptedPoints[j].y;
          if (dx * dx + dy * dy < minSpacingSq) { tooClose = true; break; }
        }
        if (!tooClose) {
          accepted.push(entry);
          acceptedPoints.push(point);
        }
      }

      // Only ever touch entries that are either currently shown (bounded
      // by MAX_VISIBLE_LABELS, cheap) or newly accepted this pass — never
      // the full dataset.
      var visibleSet = new Set(accepted);
      var toHide = [];
      shownLabelEntries.forEach(function(entry) {
        if (!visibleSet.has(entry)) { toHide.push(entry); }
      });
      toHide.forEach(function(entry) {
        map.removeLayer(entry.marker);
        entry.marker = null;
        shownLabelEntries.delete(entry);
      });
      accepted.forEach(function(entry) {
        if (!entry.marker) {
          entry.marker = makeLabelMarker(entry);
          entry.marker.addTo(map);
          shownLabelEntries.add(entry);
        }
      });
    }

    // Always-on background pane beneath the basemap tile pane (z-index
    // 200) as a second line of defense, but visibility is actually driven
    // explicitly below based on whether tiles are really loading — pure
    // z-order stacking flickers during normal tile-load latency.
    map.createPane('worldOutlinePane');
    map.getPane('worldOutlinePane').style.zIndex = 150;
    // Separate pane, above the canvas fill/line pane, so place labels
    // always paint on top of land/water polygons via real pane z-index
    // stacking rather than DOM insertion order. Both used to share
    // worldOutlinePane, which meant whichever canvas tile happened to be
    // appended to the DOM most recently (constantly, while panning) could
    // land after — and so visually cover — labels that were already there,
    // making labels only reliably visible over open water.
    map.createPane('worldOutlineLabelsPane');
    map.getPane('worldOutlineLabelsPane').style.zIndex = 160;
    // Natural Earth data is public domain and doesn't legally require
    // attribution, but crediting it is the convention their own site asks
    // for, same as the Stadia/OpenMapTiles/OSM credit already in this
    // control for the tile layer. GeoNames (used for populated places, to
    // cover far more towns than Natural Earth's curated set) is CC-BY —
    // attribution here is a real license requirement, not just courtesy.
    if (map.attributionControl) {
      map.attributionControl.addAttribution(
        '<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>, '
        + '<a href="https://www.geonames.org/" target="_blank">GeoNames</a>'
      );
    }

    var tileErrorsThisCycle = 0;
    var tilesConfirmedLoaded = false;
    // Read by updateLabelDeclutter and the canvas layer add/remove below,
    // both of which bail out / detach immediately while this is false — so
    // the real per-pan/zoom recomputation and tile-generation cost only
    // exists while genuinely offline, not just hidden-but-still-running.
    // Otherwise the upload page's online experience would degrade for a
    // feature it isn't even using yet.
    var shouldShowFallback = true;
    function evaluateOfflineFallback() {
      var isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      var wasShowing = shouldShowFallback;
      shouldShowFallback = !isOnline || !tilesConfirmedLoaded;
      var pane = map.getPane('worldOutlinePane');
      if (pane) { pane.style.display = shouldShowFallback ? '' : 'none'; }
      var labelsPane = map.getPane('worldOutlineLabelsPane');
      if (labelsPane) { labelsPane.style.display = shouldShowFallback ? '' : 'none'; }
      if (shouldShowFallback && !wasShowing) {
        // Just went offline — populate what was skipped while online.
        updateLabelDeclutter();
        if (typeof naturalEarthCanvasLayer !== 'undefined' && !map.hasLayer(naturalEarthCanvasLayer)) {
          naturalEarthCanvasLayer.addTo(map);
        }
      } else if (!shouldShowFallback && wasShowing) {
        // Back online — fully detach the canvas layer so no further tiles
        // get created while panning; labels just stay frozen (hidden via
        // the pane) rather than being torn down, which is cheap either way.
        if (typeof naturalEarthCanvasLayer !== 'undefined' && map.hasLayer(naturalEarthCanvasLayer)) {
          map.removeLayer(naturalEarthCanvasLayer);
        }
      }
    }
    tileLayer.on('loading', function() { tileErrorsThisCycle = 0; });
    tileLayer.on('tileerror', function() { tileErrorsThisCycle += 1; evaluateOfflineFallback(); });
    tileLayer.on('load', function() {
      tilesConfirmedLoaded = tileErrorsThisCycle === 0;
      evaluateOfflineFallback();
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online', evaluateOfflineFallback);
      window.addEventListener('offline', evaluateOfflineFallback);
    }
    // Shown by default until a clean tile-load signal says otherwise.
    evaluateOfflineFallback();

    // Vector layers (unlike tile layers) don't automatically repeat across
    // adjacent world copies when panning — render a handful of longitude-
    // shifted copies of each dataset (reusing the same embedded JSON, no
    // extra payload) so the background doesn't just stop a world away.
    // Back to 3 copies after testing 1: worldCopyJump modulo-wraps the pane
    // position continuously during drag, but only keeps the *center* within
    // about half a world-width of true coordinates — the viewport still has
    // width, and its edge visibly pokes into the wrapped-around side more
    // than expected in practice (confirmed by testing, not just theory).
    // A single extra copy can only safely cover one pan direction (west OR
    // east), so real gap-proofing needs both -360 and +360. Now that LOD +
    // viewport-capped label declutter do the heavy lifting on performance,
    // the render-cost difference between 1 and 3 copies is minor anyway.
    var WORLD_COPY_OFFSETS = [-360, 0, 360];
    // Boundaries, admin-1 lines, water, roads etc. render via a real Leaflet
    // GridLayer (canvas tiles) instead of duplicated vector layers. Leaflet's
    // GridLayer wraps tile x-coordinates natively (Util.wrapNum in
    // GridLayer.js core), so there's no antimeridian gap to paper over with
    // world copies, and each tile only draws the small subset of features
    // whose bbox actually intersects it — real viewport culling, not just
    // the zoom-threshold LOD the point/label system below still uses.
    // Coordinates are pre-projected to normalized Web Mercator [0,1] space
    // (matching Leaflet's own EPSG3857 tile numbering) at build time, so no
    // per-tile projection math is needed here, just a translate+scale.
    var CANVAS_LAYERS = [
      { data: CANVAS_WORLD_BOUNDARIES, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.land, strokeStyle: FALLBACK_PALETTE.boundary, lineWidth: 1 };
      } },
      { data: CANVAS_MINOR_ISLANDS, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.land, strokeStyle: FALLBACK_PALETTE.boundary, lineWidth: 0.5 };
      } },
      { data: CANVAS_URBAN_AREAS, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.urban };
      } },
      { data: CANVAS_GLACIATED_AREAS, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.glacier, alpha: 0.85 };
      } },
      { data: CANVAS_ADMIN1_BOUNDARIES, kind: 'stroke', style: function() {
        return { strokeStyle: FALLBACK_PALETTE.boundary, lineWidth: 0.5 };
      } },
      { data: CANVAS_LAKES, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.water, strokeStyle: FALLBACK_PALETTE.water, lineWidth: 0.5 };
      } },
      { data: CANVAS_PLAYAS, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.land, strokeStyle: FALLBACK_PALETTE.boundary, lineWidth: 0.5, alpha: 0.6 };
      } },
      { data: CANVAS_ANTARCTIC_ICE_SHELVES, kind: 'fill', style: function() {
        return { fillStyle: FALLBACK_PALETTE.glacier, alpha: 0.9 };
      } },
      { data: CANVAS_REEFS, kind: 'stroke', style: function() {
        return { strokeStyle: FALLBACK_PALETTE.water, lineWidth: 1 };
      } },
      { data: CANVAS_RIVERS, kind: 'stroke', style: function() {
        return { strokeStyle: FALLBACK_PALETTE.water, lineWidth: 0.75 };
      } },
      { data: CANVAS_ROADS, kind: 'stroke', style: function() {
        return { strokeStyle: FALLBACK_PALETTE.road, lineWidth: 0.75 };
      } },
    ];

    var NaturalEarthCanvasLayer = L.GridLayer.extend({
      createTile: function(coords) {
        var tile = L.DomUtil.create('canvas', 'leaflet-tile');
        var size = this.getTileSize();
        var dpr = window.devicePixelRatio || 1;
        tile.width = size.x * dpr;
        tile.height = size.y * dpr;
        var ctx = tile.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        var z = coords.z;
        var N = Math.pow(2, z);
        var tileMinX = coords.x / N, tileMaxX = (coords.x + 1) / N;
        var tileMinY = coords.y / N, tileMaxY = (coords.y + 1) / N;

        CANVAS_LAYERS.forEach(function(layerDef) {
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
                var px = (ring[i] * N - coords.x) * size.x;
                var py = (ring[i + 1] * N - coords.y) * size.y;
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
        return tile;
      },
    });
    var naturalEarthCanvasLayer = new NaturalEarthCanvasLayer({ pane: 'worldOutlinePane', tileSize: 256 });

    registerLabelDataset(PARKS_GEOJSON, 10, 400);
    registerLabelDataset(AIRPORTS_GEOJSON, 10, 400);
    registerLabelDataset(PORTS_GEOJSON, 10, 400);
    registerLabelDataset(ELEVATION_POINTS_GEOJSON, 10, 400);
    registerCompactLabelDataset(GEONAMES_PLACES, 12, 600);
    map.on('zoomend', updateLabelDeclutter);
    map.on('moveend', updateLabelDeclutter);
    // getZoom()/getBounds() throw until the map has an initial center/zoom
    // (set later via setView/fitBounds) — defer the first run until then.
    map.whenReady(function() {
      updateLabelDeclutter();
      if (shouldShowFallback && !map.hasLayer(naturalEarthCanvasLayer)) {
        naturalEarthCanvasLayer.addTo(map);
      }
    });
    }
