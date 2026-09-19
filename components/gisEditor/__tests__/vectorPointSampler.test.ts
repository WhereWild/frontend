// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isPointInPolygon } from '@/utils/geoPolygon';
import { createVectorPointSampler } from '../vectorPointSampler';
import type { GeoJsonFeatureCollection } from '../shapefileMetadata';

type Ring = [number, number][];
const square = (x: number, y: number, size: number): Ring => [
  [x, y],
  [x, y + size],
  [x + size, y + size],
  [x + size, y],
  [x, y],
];

const feature = (
  name: string | undefined,
  geometry: { type: string; coordinates: unknown } | null,
) => ({
  type: 'Feature' as const,
  geometry,
  properties: name === undefined ? {} : { name },
});

const fc = (features: ReturnType<typeof feature>[]) =>
  ({
    type: 'FeatureCollection',
    features,
  }) as unknown as GeoJsonFeatureCollection;

const classes = new Map([
  ['a', 0],
  ['b', 1],
]);

describe('createVectorPointSampler', () => {
  it('returns the first matching feature in file order', () => {
    const sampler = createVectorPointSampler(
      fc([
        feature('a', { type: 'Polygon', coordinates: [square(0, 0, 10)] }),
        feature('b', { type: 'Polygon', coordinates: [square(5, 5, 10)] }),
      ]),
      'name',
      classes,
    );
    expect(sampler.sample(7, 7)).toBe(0); // in both -> first wins
    expect(sampler.sample(12, 12)).toBe(1);
    expect(sampler.sample(50, 50)).toBeNull();
  });

  it('treats a hole as outside and each MultiPolygon part independently', () => {
    const sampler = createVectorPointSampler(
      fc([
        feature('a', {
          type: 'MultiPolygon',
          coordinates: [
            [square(0, 0, 10), square(4, 4, 2)],
            [square(20, 20, 5)],
          ],
        }),
      ]),
      'name',
      classes,
    );
    expect(sampler.sample(5, 5)).toBeNull(); // in the hole
    expect(sampler.sample(1, 1)).toBe(0);
    expect(sampler.sample(22, 22)).toBe(0); // the second part
    expect(sampler.sample(15, 15)).toBeNull(); // between parts
  });

  it('skips features that are not areas, have no geometry, or have no styled class, letting a later feature win', () => {
    const sampler = createVectorPointSampler(
      fc([
        feature('a', { type: 'Point', coordinates: [5, 5] }),
        feature('a', null),
        feature('unstyled', {
          type: 'Polygon',
          coordinates: [square(0, 0, 10)],
        }),
        feature(undefined, {
          type: 'Polygon',
          coordinates: [square(0, 0, 10)],
        }),
        feature('b', { type: 'Polygon', coordinates: [square(0, 0, 10)] }),
      ]),
      'name',
      classes,
    );
    expect(sampler.sample(5, 5)).toBe(1);
  });

  it('gives the same answer as the ray-cast primitive it replaced, on random data', () => {
    // Seeded LCG so a failure is reproducible.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const star = (cx: number, cy: number, r: number, n: number): Ring => {
      const ring: Ring = [];
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (0.4 + 0.6 * rand());
        ring.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      ring.push(ring[0]);
      return ring;
    };
    const features = Array.from({ length: 40 }, (_, i) =>
      feature(i % 2 === 0 ? 'a' : 'b', {
        type: 'MultiPolygon',
        coordinates: [
          [
            star(rand() * 100, rand() * 100, 6 + rand() * 10, 30),
            star(0, 0, 0.1, 3),
          ],
          [star(rand() * 100, rand() * 100, 4 + rand() * 6, 20)],
        ],
      }),
    );
    const collection = fc(features);
    const sampler = createVectorPointSampler(collection, 'name', classes);

    // Reference: the old sampleVector logic, verbatim -- isPointInPolygon on
    // [lat, lon] rings, exterior minus holes, first feature wins.
    const toLatLon = (ring: Ring): [number, number][] =>
      ring.map(([lng, lat]): [number, number] => [lat, lng]);
    const inPart = (lat: number, lon: number, rings: Ring[]) =>
      isPointInPolygon(lat, lon, toLatLon(rings[0])) &&
      !rings.slice(1).some((h) => isPointInPolygon(lat, lon, toLatLon(h)));
    const reference = (lat: number, lon: number): number | null => {
      for (const f of features) {
        const parts = (f.geometry as { coordinates: Ring[][] }).coordinates;
        if (parts.some((rings) => inPart(lat, lon, rings))) {
          return classes.get(String(f.properties.name)) ?? null;
        }
      }
      return null;
    };

    let hits = 0;
    for (let i = 0; i < 3000; i += 1) {
      const lat = rand() * 110 - 5;
      const lon = rand() * 110 - 5;
      const expected = reference(lat, lon);
      if (expected !== null) hits += 1;
      expect(sampler.sample(lat, lon)).toBe(expected);
    }
    // Guard against a vacuous pass: plenty of points must land inside.
    expect(hits).toBeGreaterThan(300);
  });
});
