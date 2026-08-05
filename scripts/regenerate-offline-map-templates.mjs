#!/usr/bin/env node
// Regenerates SpeciesOccurrenceMapOffline.html and
// SpeciesOccurrenceGlobeMapOffline.html from the current (non-offline)
// SpeciesOccurrenceMap.html / SpeciesOccurrenceGlobeMap.html templates,
// grafting the offline-only basemap fallback subsystem (embedded Natural
// Earth/GeoNames data, canvas/raster rendering, label declutter or
// MapLibre symbol layers, online/offline detection) back on.
//
// Why this exists: the *Offline.html files carry ~26MB of embedded data
// that would add ~300ms to every fillMapTemplatePlaceholders() call if it
// lived in the shared template (see speciesOccurrenceMapHelpers.ts's
// loadMapTemplateOffline/loadGlobeMapTemplateOffline comments) — so they
// have to stay separate files. But "separate file" previously meant a
// hand-forked copy that silently drifted out of sync with every feature
// added to the main templates (polygon drawing, the canvas perf fixes,
// etc. were all missing). This script makes "separate file" mean
// "mechanically derived from the current main file" instead, so it can't
// drift: run it again after editing SpeciesOccurrenceMap.html or
// SpeciesOccurrenceGlobeMap.html and the offline variants pick up the
// change automatically.
//
// Usage: node ./scripts/regenerate-offline-map-templates.mjs
// (or: npm run regenerate:offline-maps)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapDir = path.join(
  __dirname,
  '..',
  'components',
  'sections',
  'speciesOccurrenceMap',
);
const partialsDir = path.join(mapDir, 'offlineFallbackPartials');

const readPartial = (name) =>
  readFileSync(path.join(partialsDir, name), 'utf8').replace(/\n$/, '');

// Replaces the first (and only expected) occurrence of `anchor` in
// `content` with `replacement`. Throws if `anchor` isn't found exactly
// once, so drift in the main template (the anchor text changing or
// disappearing) fails loudly here instead of silently producing a broken
// or stale offline template.
function replaceOnce(content, anchor, replacement, label) {
  const first = content.indexOf(anchor);
  if (first === -1) {
    throw new Error(
      `regenerate-offline-map-templates: anchor for "${label}" not found. ` +
        `The main template likely changed in a way this script doesn't ` +
        `know about yet — update the anchor text below to match.`,
    );
  }
  const second = content.indexOf(anchor, first + anchor.length);
  if (second !== -1) {
    throw new Error(
      `regenerate-offline-map-templates: anchor for "${label}" matched ` +
        `more than once — needs a more specific anchor string.`,
    );
  }
  return content.slice(0, first) + replacement + content.slice(first + anchor.length);
}

function buildLeafletOffline() {
  const mainPath = path.join(mapDir, 'SpeciesOccurrenceMap.html');
  const outPath = path.join(mapDir, 'SpeciesOccurrenceMapOffline.html');
  let content = readFileSync(mainPath, 'utf8');

  // The main template still carries the doc comment describing this data
  // (left behind whenever the offline variant was first forked out) but
  // not the data itself — replacing the comment with the partial (which
  // starts with the same comment, then the actual consts) fills that back
  // in without duplicating the comment.
  const dataAnchor = [
    '    // Coarse (110m) country outlines, bundled inline so a low-context',
    '    // background is available even when the real basemap tiles can\'t be',
    '    // reached (e.g. offline). Public domain (Natural Earth), via the ISC-',
    '    // licensed world-atlas npm package, pre-converted from TopoJSON.',
    '    // Country + state/province outlines (50m Natural Earth resolution),',
    '    // bundled inline so a low-context background is available even when',
    '    // the real basemap tiles can\'t be reached (e.g. offline). Public',
    '    // domain (Natural Earth); countries pre-converted from the ISC-',
    '    // licensed world-atlas npm package\'s TopoJSON, admin-1 boundaries',
    '    // fetched directly as GeoJSON from Natural Earth\'s own repo.',
  ].join('\n');
  content = replaceOnce(
    content,
    dataAnchor,
    readPartial('leafletOfflineData.partial.js'),
    'leaflet offline data block',
  );

  const tileLayerAnchor = '    tileLayer.addTo(map);';
  content = replaceOnce(
    content,
    tileLayerAnchor,
    tileLayerAnchor + '\n\n' + readPartial('leafletOfflineLogic.partial.js'),
    'leaflet offline logic block',
  );

  writeFileSync(outPath, content);
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

function buildGlobeOffline() {
  const mainPath = path.join(mapDir, 'SpeciesOccurrenceGlobeMap.html');
  const outPath = path.join(mapDir, 'SpeciesOccurrenceGlobeMapOffline.html');
  let content = readFileSync(mainPath, 'utf8');

  // Data + protocol/palette + place-labels builder all slot in together,
  // right before mapOptions is built (same relative position they had in
  // the original hand-forked file, anchored on the skybox comment that
  // immediately precedes mapOptions in both templates).
  const skyboxAnchor = '    // ---- end starfield/cubemap skybox ----\n';
  const dataAndLogicBlock = [
    readPartial('globeOfflineDataA.partial.js'),
    readPartial('globeOfflineProtocolAndPalette.partial.js'),
    readPartial('globeOfflineDataB.partial.js'),
    readPartial('globeOfflinePlaceLabelsBuilder.partial.js'),
  ].join('\n\n');
  content = replaceOnce(
    content,
    skyboxAnchor,
    skyboxAnchor + '\n' + dataAndLogicBlock + '\n',
    'globe offline data + protocol + place-labels block',
  );

  // sources: Object.assign(...) — append the two offline sources as
  // additional arguments after the terrain-dem one.
  const sourcesAnchor =
    "          TERRAIN_TILE_URL ? { 'terrain-dem': { type: 'raster-dem', tiles: [TERRAIN_TILE_URL], tileSize: 256, maxzoom: TILE_MAX_ZOOM, encoding: 'terrarium' } } : {}\n        ),";
  content = replaceOnce(
    content,
    sourcesAnchor,
    "          TERRAIN_TILE_URL ? { 'terrain-dem': { type: 'raster-dem', tiles: [TERRAIN_TILE_URL], tileSize: 256, maxzoom: TILE_MAX_ZOOM, encoding: 'terrarium' } } : {},\n" +
      readPartial('globeOfflineSourcesFragment.partial.js') +
      '\n        ),',
    'globe offline sources fragment',
  );

  // layers: [...] .concat() chain — insert the two offline layers right
  // after the hillshade concat, before the heatmap one (same relative
  // position as the original hand-forked file).
  const layersAnchor =
    "          .concat(TERRAIN_TILE_URL ? [{ id: 'hillshade-layer', type: 'hillshade', source: 'terrain-dem', paint: { 'hillshade-exaggeration': 0.3 }, layout: { visibility: TERRAIN_ENABLED_INITIAL ? 'visible' : 'none' } }] : [])\n          .concat(HEATMAP_TILE_URL";
  content = replaceOnce(
    content,
    layersAnchor,
    "          .concat(TERRAIN_TILE_URL ? [{ id: 'hillshade-layer', type: 'hillshade', source: 'terrain-dem', paint: { 'hillshade-exaggeration': 0.3 }, layout: { visibility: TERRAIN_ENABLED_INITIAL ? 'visible' : 'none' } }] : [])\n" +
      readPartial('globeOfflineLayersFragment.partial.js') +
      '\n          .concat(HEATMAP_TILE_URL',
    'globe offline layers fragment',
  );

  // Attribution control — right before mapReady is declared.
  const mapReadyAnchor = '    let mapReady = false;';
  content = replaceOnce(
    content,
    mapReadyAnchor,
    readPartial('globeOfflineAttribution.partial.js') + '\n' + mapReadyAnchor,
    'globe offline attribution control',
  );

  // Online/offline detection — right after sendPinMessage is defined.
  const sendPinMessageAnchor =
    '    function sendPinMessage(catalogNumber, latitude, longitude) {\n' +
    '      postToParent({ type: PIN_OBSERVATION_MESSAGE_TYPE, catalogNumber: catalogNumber, latitude: latitude, longitude: longitude });\n' +
    '    }';
  content = replaceOnce(
    content,
    sendPinMessageAnchor,
    sendPinMessageAnchor + '\n\n' + readPartial('globeOfflineEvaluateFallback.partial.js'),
    'globe offline evaluateOfflineFallback block',
  );

  writeFileSync(outPath, content);
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

buildLeafletOffline();
buildGlobeOffline();
