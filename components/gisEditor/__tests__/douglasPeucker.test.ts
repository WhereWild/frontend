// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildOverviewLevels,
  countVertices,
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
