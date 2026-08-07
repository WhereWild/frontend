// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  decodePolygonsParam,
  decodePolyline,
  encodePolygonsParam,
  encodePolyline,
  isPointInPolygon,
} from '../geoPolygon';

describe('isPointInPolygon', () => {
  const square: [number, number][] = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ];

  it('returns true for a point inside the ring', () => {
    expect(isPointInPolygon(5, 5, square)).toBe(true);
  });

  it('returns false for a point outside the ring', () => {
    expect(isPointInPolygon(50, 50, square)).toBe(false);
  });
});

// decode_polyline in wherewild/util/stats.py is the authoritative decoder
// this must match byte-for-byte (verified manually cross-language during
// development, including feeding a JS-encoded string into the Python
// decoder directly) — these tests only check this implementation's own
// internal consistency (round-trips through itself and its own decoder),
// not cross-language agreement.
describe('encodePolyline / encodePolygonsParam', () => {
  it('produces the known Google polyline algorithm test vector', () => {
    // The canonical example from Google's own encoded-polyline docs.
    const points: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('joins multiple rings with a semicolon', () => {
    const ring1: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];
    const ring2: [number, number][] = [
      [20, 20],
      [20, 30],
      [30, 30],
      [30, 20],
    ];
    const param = encodePolygonsParam([ring1, ring2]);
    const parts = param.split(';');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(encodePolyline(ring1));
    expect(parts[1]).toBe(encodePolyline(ring2));
  });

  it('drops rings with fewer than 3 vertices', () => {
    const tooFew: [number, number][] = [
      [0, 0],
      [1, 1],
    ];
    const validRing: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];
    const param = encodePolygonsParam([tooFew, validRing]);
    expect(param.split(';')).toHaveLength(1);
  });

  it('returns an empty string for no polygons', () => {
    expect(encodePolygonsParam([])).toBe('');
  });

  it('simplifies a ring with many collinear points down under the vertex cap', () => {
    // 1000 points along a straight line plus one real corner — Douglas-
    // Peucker should collapse the collinear run down near to its
    // endpoints, landing well under the 300-vertex cap either way.
    const denseRing: [number, number][] = [];
    for (let i = 0; i < 1000; i++) {
      denseRing.push([i * 0.0001, 0]);
    }
    denseRing.push([0.05, 0.05]);
    const encoded = encodePolygonsParam([denseRing]);
    expect(encoded.length).toBeGreaterThan(0);
    // A round trip through the same encoder on the raw (unsimplified)
    // ring would be at least 1000 points' worth of bytes — confirms
    // simplification actually reduced the payload, not just no-opped.
    expect(encoded.length).toBeLessThan(encodePolyline(denseRing).length);
  });
});

describe('decodePolyline / decodePolygonsParam', () => {
  it('round-trips through encodePolyline', () => {
    const points: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
      [-1.234, 179.9999],
    ];
    const decoded = decodePolyline(encodePolyline(points));
    expect(decoded).toHaveLength(points.length);
    decoded.forEach(([lat, lon], i) => {
      expect(lat).toBeCloseTo(points[i][0], 4);
      expect(lon).toBeCloseTo(points[i][1], 4);
    });
  });

  it('throws on a truncated polyline', () => {
    expect(() => decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq')).toThrow();
  });

  it('round-trips a full encodePolygonsParam through decodePolygonsParam', () => {
    const ring1: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];
    const ring2: [number, number][] = [
      [20, 20],
      [20, 30],
      [30, 30],
      [30, 20],
    ];
    const param = encodePolygonsParam([ring1, ring2]);
    const decoded = decodePolygonsParam(param);
    expect(decoded).toHaveLength(2);
    decoded[0].forEach(([lat, lon], i) => {
      expect(lat).toBeCloseTo(ring1[i][0], 4);
      expect(lon).toBeCloseTo(ring1[i][1], 4);
    });
    decoded[1].forEach(([lat, lon], i) => {
      expect(lat).toBeCloseTo(ring2[i][0], 4);
      expect(lon).toBeCloseTo(ring2[i][1], 4);
    });
  });

  it('returns an empty array for null/undefined/empty input', () => {
    expect(decodePolygonsParam(null)).toEqual([]);
    expect(decodePolygonsParam(undefined)).toEqual([]);
    expect(decodePolygonsParam('')).toEqual([]);
  });

  it('skips a malformed ring instead of throwing, keeping the valid ones', () => {
    const validRing: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];
    const param = `notvalid;${encodePolyline(validRing)}`;
    const decoded = decodePolygonsParam(param);
    expect(decoded).toHaveLength(1);
    decoded[0].forEach(([lat, lon], i) => {
      expect(lat).toBeCloseTo(validRing[i][0], 4);
      expect(lon).toBeCloseTo(validRing[i][1], 4);
    });
  });
});
