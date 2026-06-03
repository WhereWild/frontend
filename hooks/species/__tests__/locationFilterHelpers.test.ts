// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LocationSearchResult } from '@/data/types';
import {
  buildLocationCacheKey,
  filterCandidatesByParent,
  findLocationByNameInMap,
  inferParentSelection,
  resolveParentLookup,
} from '../locationFilterHelpers';

const makeLocation = (overrides: Partial<LocationSearchResult>): LocationSearchResult => ({
  gid: 'gid-default',
  name: 'Default',
  level: 0,
  hierarchy: [],
  ...overrides,
});

describe('locationFilterHelpers', () => {
  it('finds location by name case-insensitively', () => {
    const map = {
      one: makeLocation({ gid: 'country-us', name: 'United States' }),
    };

    expect(findLocationByNameInMap('united states', map)?.gid).toBe('country-us');
    expect(findLocationByNameInMap('missing', map)).toBeNull();
  });

  it('resolves parent lookup using gid identity when available', () => {
    const countryMap = {
      'country-us': makeLocation({ gid: 'country-us', name: 'United States' }),
    };

    const result = resolveParentLookup({
      level: 'state',
      parentGidOrName: 'country-us',
      countryMap,
      stateMap: {},
    });

    expect(result).toEqual({
      parentRequestToken: 'United States',
      parentFilterToken: 'country-us',
      parentCacheIdentity: 'gid:country-us',
    });
  });

  it('filters candidates by parent token in hierarchy', () => {
    const candidates = [
      makeLocation({ gid: 'state-ut', name: 'Utah', hierarchy: ['Region', 'United States'] }),
      makeLocation({ gid: 'state-bc', name: 'British Columbia', hierarchy: ['Region', 'Canada'] }),
    ];

    expect(filterCandidatesByParent(candidates, 'united states').map((value) => value.gid)).toEqual([
      'state-ut',
    ]);
    expect(filterCandidatesByParent(candidates, null)).toHaveLength(2);
  });

  it('keeps candidates when parent token is a gid and hierarchy labels are names', () => {
    const candidates = [
      makeLocation({ gid: 'state-ut', name: 'Utah', hierarchy: ['Region', 'United States'] }),
    ];

    expect(filterCandidatesByParent(candidates, 'country-us')).toEqual([]);
  });

  it('infers parent selection for county entries', () => {
    const countryMap = {
      'country-us': makeLocation({ gid: 'country-us', name: 'United States', level: 0 }),
    };
    const stateMap = {
      'state-ut': makeLocation({ gid: 'state-ut', name: 'Utah', level: 1 }),
    };

    const inferred = inferParentSelection(
      makeLocation({
        gid: 'county-salt-lake',
        name: 'Salt Lake',
        level: 2,
        hierarchy: ['North America', 'United States', 'Utah', 'Salt Lake'],
      }),
      countryMap,
      stateMap,
    );

    expect(inferred).toEqual({
      countyGid: 'county-salt-lake',
      stateGid: 'state-ut',
      countryGid: 'country-us',
    });
  });

  it('infers parent selection from gid-based hierarchy entries', () => {
    const countryMap = {
      'country-us': makeLocation({ gid: 'country-us', name: 'United States', level: 0 }),
    };
    const stateMap = {
      'state-ut': makeLocation({ gid: 'state-ut', name: 'Utah', level: 1 }),
    };

    const inferred = inferParentSelection(
      makeLocation({
        gid: 'county-salt-lake',
        name: 'Salt Lake',
        level: 2,
        hierarchy: ['region-1', 'country-us', 'state-ut'],
      }),
      countryMap,
      stateMap,
    );

    expect(inferred).toEqual({
      countyGid: 'county-salt-lake',
      stateGid: 'state-ut',
      countryGid: 'country-us',
    });
  });

  it('builds stable cache keys', () => {
    expect(buildLocationCacheKey(10, 'county', 'gid:state-ut', 500)).toBe(
      '10::county::gid:state-ut::limit:500',
    );
  });
});
