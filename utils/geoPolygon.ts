// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Region-filter geometry shared by both places a drawn/uploaded polygon
// needs to restrict observations: the map's own client-side filter (see
// speciesOccurrenceMapHelpers.ts, which re-exports these) and the fully
// offline custom-upload data source (uploadLocalSpeciesDataSource.build.ts),
// which has no backend to send a `polygon` query param to and so has to
// reproduce wherewild/util/stats.py's decode_polyline/apply_polygon_filter
// logic in-browser instead. Kept here rather than in the map's own helpers
// module specifically so the data layer doesn't have to import from
// components/ to get it.

// Even-odd ray-casting point-in-polygon test — client-side only, against
// whatever occurrences are already fetched/loaded. Treats latitude/
// longitude as plain y/x, which breaks down for a polygon that crosses the
// antimeridian (±180°); not handled here since the draw tool itself has no
// way to express that today.
export const isPointInPolygon = (
  lat: number,
  lon: number,
  polygon: readonly (readonly [number, number])[],
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const crossesRay = latI > lat !== latJ > lat;
    if (
      crossesRay &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// Google's encoded-polyline algorithm (same one Google Maps/Mapbox use) —
// ~5 bytes per point at 5-decimal precision vs ~20-40 for a raw JSON
// [lat, lon] pair, which matters since a drawn/uploaded region's vertices
// travel as a single query-string parameter (see encodePolygonsParam) —
// this is the mirror of decode_polyline/encode_polyline (test-only) in
// wherewild's util/stats.py.
const encodeSignedPolylineNumber = (num: number): string => {
  let value = num < 0 ? ~(num << 1) : num << 1;
  let output = '';
  while (value >= 0x20) {
    output += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  output += String.fromCharCode(value + 63);
  return output;
};

export const encodePolyline = (
  points: readonly (readonly [number, number])[],
  precision = 5,
): string => {
  const factor = 10 ** precision;
  let output = '';
  let prevLat = 0;
  let prevLon = 0;
  for (const [lat, lon] of points) {
    const latI = Math.round(lat * factor);
    const lonI = Math.round(lon * factor);
    output +=
      encodeSignedPolylineNumber(latI - prevLat) +
      encodeSignedPolylineNumber(lonI - prevLon);
    prevLat = latI;
    prevLon = lonI;
  }
  return output;
};

// Inverse of encodePolyline — decodes one ring back into [lat, lon] pairs.
// Only the offline data source needs this today (the map only ever
// encodes, since decoding happens server-side); kept alongside the encoder
// so the two can't drift apart.
export const decodePolyline = (
  encoded: string,
  precision = 5,
): [number, number][] => {
  const factor = 10 ** precision;
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const length = encoded.length;
  while (index < length) {
    for (const isLat of [true, false]) {
      let shift = 0;
      let result = 0;
      for (;;) {
        if (index >= length) {
          throw new Error('truncated polyline');
        }
        const byte = encoded.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
        if (byte < 0x20) {
          break;
        }
      }
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (isLat) {
        lat += delta;
      } else {
        lon += delta;
      }
    }
    coordinates.push([lat / factor, lon / factor]);
  }
  return coordinates;
};

const perpendicularDistance = (
  point: readonly [number, number],
  lineStart: readonly [number, number],
  lineEnd: readonly [number, number],
): number => {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + clampedT * dx), py - (y1 + clampedT * dy));
};

// Iterative (stack, not recursive call frames) Douglas-Peucker line
// simplification — an uploaded GeoJSON boundary can have many thousands of
// vertices, and a recursive version's call-stack depth would scale with
// input size in the pathological (near-collinear) case.
const douglasPeucker = (
  points: readonly (readonly [number, number])[],
  epsilon: number,
): (readonly [number, number])[] => {
  const n = points.length;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop() as [number, number];
    let maxDistance = 0;
    let maxIndex = -1;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const distance = perpendicularDistance(
        points[i],
        points[startIdx],
        points[endIdx],
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxIndex !== -1 && maxDistance > epsilon) {
      keep[maxIndex] = 1;
      stack.push([startIdx, maxIndex], [maxIndex, endIdx]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
};

const MAX_POLYGON_RING_VERTICES = 300;

// Caps a ring to at most MAX_POLYGON_RING_VERTICES via iterative Douglas-
// Peucker, doubling epsilon each pass until it fits. Hand-drawn polygons
// rarely need this (Geoman naturally limits how many vertices a user
// clicks out), but an uploaded GeoJSON boundary can have thousands — this
// is what keeps the `polygon` query param from ballooning in that case.
const simplifyRing = (
  ring: readonly (readonly [number, number])[],
  maxPoints: number,
): readonly (readonly [number, number])[] => {
  if (ring.length <= maxPoints) return ring.slice();
  let epsilon = 1e-5;
  let simplified: readonly (readonly [number, number])[] = ring;
  for (let attempt = 0; attempt < 20 && simplified.length > maxPoints; attempt++) {
    simplified = douglasPeucker(ring, epsilon);
    epsilon *= 2;
  }
  return simplified;
};

// Encodes every drawn/uploaded region into the ';'-joined polyline format
// wherewild's util/stats.py::parse_polygon_param expects for the `polygon`
// query param on /environment/{variable}, /slice, and
// /class/{value}/samples — same union-of-regions semantics as the
// client-side isPointInPolygon filter above.
export const encodePolygonsParam = (
  polygons: readonly (readonly (readonly [number, number])[])[],
): string =>
  polygons
    .filter((ring) => ring.length >= 3)
    .map((ring) => encodePolyline(simplifyRing(ring, MAX_POLYGON_RING_VERTICES)))
    .join(';');

// Inverse of encodePolygonsParam — used only by the offline data source,
// which receives the same encoded `polygon` string the remote data source
// would send over the network, but has to decode and apply it itself
// in-browser instead. A malformed ring is skipped rather than thrown (this
// param normally only ever comes from our own encoder, but a bad ring
// shouldn't take down the whole stats panel if something upstream did
// produce one) — unlike the backend's parse_polygon_param, which does
// reject the whole request on bad input, since there it's arbitrary
// query-string input from the network rather than same-process state.
export const decodePolygonsParam = (
  param: string | null | undefined,
): [number, number][][] => {
  if (!param) return [];
  const rings: [number, number][][] = [];
  for (const encodedRing of param.split(';')) {
    if (!encodedRing) continue;
    try {
      const ring = decodePolyline(encodedRing);
      if (ring.length >= 3) {
        rings.push(ring);
      }
    } catch {
      // Skip this ring; see doc comment above.
    }
  }
  return rings;
};
