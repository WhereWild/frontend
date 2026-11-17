// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Self-contained map document for the visualization study (see StudyDotMap).
// Deliberately NOT the shared SpeciesOccurrenceMap template: a flat Mercator
// MapLibre map with a raster basemap, and the observation dots drawn by us on
// a canvas overlay from ready-made colors. No GeoJSON source means no worker
// tile (re)loads to go stale when the dots change, no clustering, no globe,
// no offline-fallback data - a swap is a redraw plus a camera fit.
//
// Protocol (postMessage):
//   parent -> map  { type: 'studyPoints', token, points: [[lon, lat, color, id, label], ...] }
//                  replaces the dots, clears the selection, fits the view
//                  { type: 'studySelect', id | null }  selects a dot (popup + ring)
//   map -> parent  { type: 'studyDrawn', token }   dots drawn AND basemap loaded
//                  { type: 'studyPin', id, lat, lon }  a dot was clicked, or its
//                                  popup's close button (the parent toggles)
//                  { type: 'studyKey', key }  a key was pressed while the map
//                                  had focus (keyboard answers still work)

export type StudyDotMapConfig = {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  /** Basemap surface color shown while tiles load. */
  background: string;
};

const MAPLIBRE_VERSION = '5.24.0';

export const buildStudyDotMapHtml = (config: StudyDotMapConfig): string => {
  // `<` is escaped so no config string can close the script element.
  const configJson = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
<style>
  html, body { margin: 0; height: 100%; width: 100%; overflow: hidden; }
  #wrap { position: relative; width: 100%; height: 100%; }
  #map { position: absolute; inset: 0; }
  #dots { position: absolute; left: 0; top: 0; pointer-events: none; }
  .maplibregl-popup-content { padding: 8px 26px 8px 10px; font: 12px sans-serif; }
</style>
</head>
<body>
<div id="wrap"><div id="map"></div><canvas id="dots"></canvas></div>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<script>
(function () {
  var CFG = ${configJson};
  var RADIUS = 5;
  var HIT_RADIUS = 9;
  var MAX_DRAWN_WAIT_MS = 4000;

  var map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        basemap: { type: 'raster', tiles: [CFG.tileUrl], tileSize: 256, maxzoom: CFG.maxZoom, attribution: CFG.attribution }
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': CFG.background } },
        { id: 'basemap', type: 'raster', source: 'basemap' }
      ]
    },
    center: [0, 20],
    zoom: 2,
    maxZoom: CFG.maxZoom,
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
    maxPitch: 0,
    attributionControl: { compact: true }
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  var canvas = document.getElementById('dots');
  var ctx = canvas.getContext('2d');
  var points = [];
  var selectedId = null;
  var selectedIndex = -1;
  var popup = null;
  var suppressPopupClose = false;
  var loaded = false;
  var pendingPointsMessage = null;
  var pendingSelectId = null;

  function post(msg) { window.parent.postMessage(msg, '*'); }

  function sizeCanvas() {
    var el = map.getContainer();
    var ratio = window.devicePixelRatio || 1;
    var w = el.clientWidth, h = el.clientHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // Dot positions on a flat Mercator map are plain arithmetic from the map's
  // center and zoom (no rotation or pitch), so each frame needs no map.project
  // calls. mx/my are precomputed world coordinates (0..1); sx/sy are the screen
  // positions from the latest draw, reused by hit-testing. Dots of one color are
  // drawn as a single path (one style change per distinct color, not per dot).
  var mx = new Float64Array(0), my = new Float64Array(0);
  var sx = new Float64Array(0), sy = new Float64Array(0);
  var groups = [];
  var useProject = false;

  function worldX(lon) { return (lon + 180) / 360; }
  function worldY(lat) {
    var clamped = Math.max(-85.0511, Math.min(85.0511, lat));
    return (1 - Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360)) / Math.PI) / 2;
  }

  function indexPoints() {
    var n = points.length;
    mx = new Float64Array(n); my = new Float64Array(n);
    sx = new Float64Array(n); sy = new Float64Array(n);
    var byColor = {};
    groups = [];
    for (var i = 0; i < n; i++) {
      mx[i] = worldX(points[i].lon);
      my[i] = worldY(points[i].lat);
      var g = byColor[points[i].color];
      if (!g) { g = byColor[points[i].color] = { color: points[i].color, idx: [] }; groups.push(g); }
      g.idx.push(i);
    }
  }

  function draw() {
    var el = map.getContainer();
    var w = el.clientWidth, h = el.clientHeight;
    ctx.clearRect(0, 0, w, h);
    var n = points.length;
    if (!n) return;
    var scale = 512 * Math.pow(2, map.getZoom());
    var c = map.getCenter();
    var ox = w / 2 - worldX(c.lng) * scale;
    var oy = h / 2 - worldY(c.lat) * scale;
    // Guard: if the fast formula ever disagrees with the map's own projection
    // (e.g. a rotated or pitched view), fall back to map.project.
    var probe = map.project([points[0].lon, points[0].lat]);
    useProject = Math.abs(probe.x - (mx[0] * scale + ox)) > 1 || Math.abs(probe.y - (my[0] * scale + oy)) > 1;
    for (var i = 0; i < n; i++) {
      if (useProject) {
        var p = map.project([points[i].lon, points[i].lat]);
        sx[i] = p.x; sy[i] = p.y;
      } else {
        sx[i] = mx[i] * scale + ox;
        sy[i] = my[i] * scale + oy;
      }
    }
    ctx.globalAlpha = 0.9;
    var TAU = Math.PI * 2;
    var R = RADIUS + 0.5;
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      ctx.fillStyle = g.color;
      ctx.beginPath();
      for (var k = 0; k < g.idx.length; k++) {
        var j = g.idx[k];
        var x = sx[j], y = sy[j];
        if (x < -R || x > w + R || y < -R || y > h + R) continue;
        ctx.moveTo(x + R, y);
        ctx.arc(x, y, R, 0, TAU);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (selectedIndex >= 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx[selectedIndex], sy[selectedIndex], RADIUS + 4, 0, TAU);
      ctx.stroke();
    }
  }

  // Uses the screen positions from the latest draw.
  function nearestDot(x, y) {
    var best = null, bestD = HIT_RADIUS * HIT_RADIUS;
    for (var i = 0; i < points.length; i++) {
      var dx = sx[i] - x, dy = sy[i] - y;
      var d = dx * dx + dy * dy;
      // <= so a later dot wins an exact tie.
      if (d <= bestD) { bestD = d; best = points[i]; }
    }
    return best;
  }

  function closePopupSilently() {
    if (!popup) return;
    suppressPopupClose = true;
    popup.remove();
    suppressPopupClose = false;
    popup = null;
  }

  function select(id) {
    closePopupSilently();
    selectedId = id;
    selectedIndex = -1;
    var pt = null;
    for (var i = 0; i < points.length; i++) { if (points[i].id === id) { pt = points[i]; selectedIndex = i; break; } }
    if (id != null && pt) {
      var swatch = document.createElement('span');
      swatch.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:' + pt.color;
      var text = document.createElement('span');
      text.textContent = pt.label;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center';
      row.appendChild(swatch);
      row.appendChild(text);
      popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, focusAfterOpen: false, offset: 10 })
        .setLngLat([pt.lon, pt.lat])
        .setDOMContent(row)
        .addTo(map);
      popup.on('close', function () {
        // Clicking the popup's x asks the parent to toggle the selection off
        // (same convention as the shared map); programmatic closes don't.
        if (!suppressPopupClose) post({ type: 'studyPin', id: pt.id, lat: pt.lat, lon: pt.lon });
      });
    }
    draw();
  }

  // Tell the parent once the new dots are drawn and the basemap for the new
  // view has loaded (polled: 'idle' doesn't re-fire when the view didn't move).
  function reportDrawnWhenLoaded(token) {
    var started = Date.now();
    (function poll() {
      if (token !== currentToken) return;
      if ((map.loaded() && !map.isMoving()) || Date.now() - started > MAX_DRAWN_WAIT_MS) {
        post({ type: 'studyDrawn', token: token });
        return;
      }
      setTimeout(poll, 80);
    })();
  }

  var currentToken = null;
  function applyPoints(msg) {
    currentToken = msg.token;
    points = (msg.points || []).map(function (a) {
      return { lon: a[0], lat: a[1], color: a[2], id: a[3], label: a[4] };
    });
    closePopupSilently();
    selectedId = null;
    selectedIndex = -1;
    indexPoints();
    if (points.length) {
      var minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      points.forEach(function (pt) {
        if (pt.lon < minLon) minLon = pt.lon;
        if (pt.lon > maxLon) maxLon = pt.lon;
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
      });
      map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 40, duration: 0, maxZoom: 13 });
    }
    draw();
    map.triggerRepaint();
    reportDrawnWhenLoaded(msg.token);
  }

  map.on('render', draw);
  map.on('resize', function () { sizeCanvas(); draw(); });
  map.on('click', function (e) {
    var hit = nearestDot(e.point.x, e.point.y);
    if (hit) post({ type: 'studyPin', id: hit.id, lat: hit.lat, lon: hit.lon });
  });
  var hoverFrame = null;
  map.on('mousemove', function (e) {
    if (hoverFrame) return;
    var x = e.point.x, y = e.point.y;
    hoverFrame = requestAnimationFrame(function () {
      hoverFrame = null;
      map.getCanvas().style.cursor = nearestDot(x, y) ? 'pointer' : '';
    });
  });

  window.addEventListener('keydown', function (e) {
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) post({ type: 'studyKey', key: e.key });
  });

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'studyPoints') {
      if (loaded) applyPoints(data); else pendingPointsMessage = data;
    } else if (data.type === 'studySelect') {
      if (loaded) select(data.id == null ? null : data.id); else pendingSelectId = data.id;
    }
  });

  sizeCanvas();
  map.on('load', function () {
    loaded = true;
    sizeCanvas();
    if (pendingPointsMessage) { applyPoints(pendingPointsMessage); pendingPointsMessage = null; }
    if (pendingSelectId != null) { select(pendingSelectId); pendingSelectId = null; }
  });
})();
</script>
</body>
</html>`;
};
