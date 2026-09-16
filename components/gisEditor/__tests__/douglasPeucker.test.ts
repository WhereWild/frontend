// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildOverviewLevels,
  countVertices,
  deserializeOverviewLevels,
  serializeOverviewLevels,
  simplifyFeatureCollection,
  simplifyLine,
  type Point,
} from '../douglasPeucker';

describe('simplifyLine', () => {
  it('keeps a line with 2 or fewer points unchanged', () => {
    expect(simplifyLine([[0, 0]], 1)).toEqual([[0, 0]]);
    expect(
      simplifyLine(
        [
          [0, 0],
          [1, 1],
        ],
        1,
      ),
    ).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('drops a point that lies almost exactly on the line between its neighbors', () => {
    const points: Point[] = [
      [0, 0],
      [5, 0.0001],
      [10, 0],
    ];
    expect(simplifyLine(points, 1)).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it('keeps a point that deviates more than the tolerance', () => {
    const points: Point[] = [
      [0, 0],
      [5, 10],
      [10, 0],
    ];
    expect(simplifyLine(points, 1)).toEqual([
      [0, 0],
      [5, 10],
      [10, 0],
    ]);
  });

  it('always keeps the first and last point, even with tolerance 0 doing nothing', () => {
    const points: Point[] = [
      [0, 0],
      [1, 1],
      [2, 0],
    ];
    expect(simplifyLine(points, 0)).toEqual(points);
  });

  it('handles a long, nearly straight line without stack overflow (iterative, not recursive)', () => {
    const points: Point[] = [];
    for (let i = 0; i < 50000; i += 1) {
      points.push([i, i % 2 === 0 ? 0 : 0.00001]);
    }
    const result = simplifyLine(points, 1);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    expect(result.length).toBeLessThan(points.length);
  });
});

const square = (size: number): [number, number][] => [
  [0, 0],
  [size, 0],
  [size, size],
  [0, size],
  [0, 0],
];

describe('simplifyFeatureCollection', () => {
  it('simplifies a LineString feature', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [5, 0.0001],
              [10, 0],
            ],
          },
        },
      ],
    };
    const simplified = simplifyFeatureCollection(fc, 1);
    expect(simplified.features[0].geometry?.coordinates).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it('drops a Polygon ring that collapses below 4 points, and the feature if every ring does', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: {
            type: 'Polygon',
            // A tiny near-degenerate ring — a huge tolerance should
            // collapse it entirely.
            coordinates: [square(0.0001)],
          },
        },
      ],
    };
    const simplified = simplifyFeatureCollection(fc, 10);
    expect(simplified.features).toHaveLength(0);
  });

  it('keeps a real Polygon ring intact under a small tolerance', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'a square' },
          geometry: { type: 'Polygon', coordinates: [square(10)] },
        },
      ],
    };
    const simplified = simplifyFeatureCollection(fc, 0.001);
    expect(simplified.features).toHaveLength(1);
    expect(simplified.features[0].properties).toEqual({ name: 'a square' });
    const ring = simplified.features[0].geometry?.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]); // still closed
  });

  it('is a no-op for Point geometry (nothing to simplify)', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: { type: 'Point', coordinates: [1, 2] },
        },
      ],
    };
    expect(simplifyFeatureCollection(fc, 100)).toEqual(fc);
  });
});

describe('countVertices', () => {
  it('counts points across mixed geometry types', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
        {
          type: 'Feature' as const,
          properties: null,
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1],
              [2, 2],
            ],
          },
        },
        {
          type: 'Feature' as const,
          properties: null,
          geometry: { type: 'Polygon', coordinates: [square(1)] },
        },
      ],
    };
    // 1 (point) + 3 (line) + 5 (square ring, closed) = 9
    expect(countVertices(fc)).toBe(9);
  });
});

describe('buildOverviewLevels', () => {
  it('level 0 is always the untouched original', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: { type: 'Polygon', coordinates: [square(10)] },
        },
      ],
    };
    const levels = buildOverviewLevels(fc, 1);
    expect(levels[0]).toEqual({ tolerance: 0, data: fc });
  });

  it('stops once a level drops under the target vertex count', () => {
    const points: [number, number][] = [];
    for (let i = 0; i < 1000; i += 1) {
      points.push([i * 0.001, Math.sin(i) * 0.01]);
    }
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: { type: 'LineString', coordinates: points },
        },
      ],
    };
    const levels = buildOverviewLevels(fc, 100);
    expect(levels.length).toBeGreaterThan(1);
    const last = levels[levels.length - 1];
    const lastCount = countVertices(last.data);
    expect(lastCount <= 100 || last.tolerance === 0.0256).toBe(true);
    // Every level after 0 should have fewer-or-equal vertices than the one before.
    for (let i = 1; i < levels.length; i += 1) {
      expect(countVertices(levels[i].data)).toBeLessThanOrEqual(
        countVertices(levels[i - 1].data),
      );
    }
  });
});

describe('serializeOverviewLevels / deserializeOverviewLevels', () => {
  const points: [number, number][] = [];
  for (let i = 0; i < 500; i += 1) {
    points.push([i * 0.001, Math.sin(i) * 0.01]);
  }
  const fc = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { NAME: 'A' },
        geometry: { type: 'LineString', coordinates: points },
      },
      {
        type: 'Feature' as const,
        properties: { NAME: 'B' },
        geometry: { type: 'LineString', coordinates: points },
      },
    ],
  };

  it('round-trips a real pyramid through serialize -> deserialize', () => {
    const levels = buildOverviewLevels(fc, 50);
    expect(levels.length).toBeGreaterThan(1);

    const serialized = serializeOverviewLevels(levels);
    const restored = deserializeOverviewLevels(serialized, fc);

    expect(restored).not.toBeNull();
    expect(restored).toHaveLength(levels.length);
    // Level 0 is always the original, untouched, byte-for-byte the same
    // object the caller passed in as `original` -- nothing to reconstruct.
    expect(restored![0]).toEqual({ tolerance: 0, data: fc });
    for (let i = 1; i < levels.length; i += 1) {
      expect(restored![i].tolerance).toBe(levels[i].tolerance);
      expect(restored![i].data.features.map((f) => f.geometry)).toEqual(
        levels[i].data.features.map((f) => f.geometry),
      );
      // Properties (not part of the cache -- see serializeOverviewLevels'
      // doc comment) come back from `original`, unchanged.
      expect(restored![i].data.features[0].properties).toEqual({
        NAME: 'A',
      });
    }
  });

  it('rejects a cache from a different version', () => {
    const serialized = serializeOverviewLevels(buildOverviewLevels(fc, 50));
    const tampered = { ...serialized, version: 999 };
    expect(deserializeOverviewLevels(tampered, fc)).toBeNull();
  });

  it('rejects a cache with mismatched tolerance steps', () => {
    const serialized = serializeOverviewLevels(buildOverviewLevels(fc, 50));
    const tampered = { ...serialized, toleranceSteps: [0.1, 0.2] };
    expect(deserializeOverviewLevels(tampered, fc)).toBeNull();
  });

  it('rejects a cache whose geometry count no longer matches the file', () => {
    const serialized = serializeOverviewLevels(buildOverviewLevels(fc, 50));
    const fewerFeatures = { ...fc, features: [fc.features[0]] };
    expect(deserializeOverviewLevels(serialized, fewerFeatures)).toBeNull();
  });

  it('rejects garbage input outright', () => {
    expect(deserializeOverviewLevels(null, fc)).toBeNull();
    expect(deserializeOverviewLevels('not a pyramid', fc)).toBeNull();
    expect(deserializeOverviewLevels({ foo: 'bar' }, fc)).toBeNull();
  });

  it('a pyramid that stops after one step (already under target) still round-trips', () => {
    // A 4-corner square has nothing left for Douglas-Peucker to drop at any
    // reasonable tolerance -- buildOverviewLevels still always tries (and
    // keeps) its first tolerance step before checking the target, so this
    // is 2 levels (original + one, geometrically identical, "simplified"
    // copy), not the 1-level, nothing-to-cache case a real huge file
    // dropping under target on its first step never actually hits either.
    const tiny = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: null,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const levels = buildOverviewLevels(tiny, 100000);
    expect(levels).toHaveLength(2);
    const serialized = serializeOverviewLevels(levels);
    expect(serialized.levels).toHaveLength(1);
    const restored = deserializeOverviewLevels(serialized, tiny);
    expect(restored).toEqual(levels);
  });
});
