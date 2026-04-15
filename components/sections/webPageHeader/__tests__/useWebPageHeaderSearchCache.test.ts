import {
  buildTaxaQueryCacheKey,
  readCachedTaxaQuery,
  resetTaxaQuerySessionCache,
  writeCachedTaxaQuery,
} from '@/hooks/search/taxaQuerySearchCache';

const createPayload = (taxonId: number) =>
  ({
    query: null,
    scope: {
      withinTaxon: null,
      withinTaxonId: null,
      descendantRank: null,
      location: null,
      minSamples: 0,
      includeSpeciesLike: false,
    },
    sort: {
      variable: null,
      metric: null,
      order: null,
      units: null,
    },
    total: 1,
    matchedTotal: 1,
    eligibleTotal: 1,
    emptyReason: null,
    limit: 1,
    offset: 0,
    results: [
      {
        taxon_id: taxonId,
        scientific_name: `Species ${taxonId}`,
        common_name: `Common ${taxonId}`,
        common_names: [`Common ${taxonId}`],
        image_source: null,
        _raw: {},
      },
    ],
  }) as any;

describe('taxaQuerySearchCache', () => {
  beforeEach(() => {
    resetTaxaQuerySessionCache();
  });

  it('builds a stable cache key from taxa query params', () => {
    expect(
      buildTaxaQueryCacheKey({
        q: ' wolf ',
        withinTaxonId: 77,
        descendantRank: 'species',
        limit: 10,
        offset: 0,
      }),
    ).toBe('limit=10&offset=0&q=wolf&within_taxon=77&descendant_rank=SPECIES');
  });

  it('returns null when a cache entry is missing', () => {
    expect(readCachedTaxaQuery('missing')).toBeNull();
  });

  it('clears cached entries when the session cache is reset', () => {
    writeCachedTaxaQuery('same', createPayload(1));

    resetTaxaQuerySessionCache();

    expect(readCachedTaxaQuery('same')).toBeNull();
  });

  it('returns the latest payload for an overwritten cache key', () => {
    writeCachedTaxaQuery('same', createPayload(1));
    writeCachedTaxaQuery('same', createPayload(2));

    expect(readCachedTaxaQuery('same')).toEqual(createPayload(2));
  });

  it('refreshes recency on cache reads before applying eviction', () => {
    for (let index = 1; index <= 50; index += 1) {
      writeCachedTaxaQuery(`key-${index}`, createPayload(index));
    }

    expect(readCachedTaxaQuery('key-1')).toEqual(createPayload(1));

    writeCachedTaxaQuery('key-51', createPayload(51));

    expect(readCachedTaxaQuery('key-2')).toBeNull();
    expect(readCachedTaxaQuery('key-1')).toEqual(createPayload(1));
    expect(readCachedTaxaQuery('key-51')).toEqual(createPayload(51));
  });
});
