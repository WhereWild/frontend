// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildChainDescriptionText,
  clearChainEntries,
  popRestorable,
  removeChainEntry,
  stashOutgoing,
} from '../useVariableFilterChain';

type Entry = {
  variableId: string;
  isCategorical: boolean;
  label: string;
  originalRanges?: { start: number; end: number }[];
};

const getKey = (e: Entry) => e.variableId;

const rangeEntry = (variableId: string, start: number, end: number): Entry => ({
  variableId,
  isCategorical: false,
  label: `${start} to ${end}`,
  originalRanges: [{ start, end }],
});

const categoryEntry = (variableId: string, label: string): Entry => ({
  variableId,
  isCategorical: true,
  label,
});

describe('stashOutgoing', () => {
  it('appends a new entry for the outgoing key', () => {
    const chain: Entry[] = [];
    const next = stashOutgoing(
      chain,
      'elevation',
      getKey,
      rangeEntry('elevation', 500, 1500),
    );
    expect(next).toEqual([rangeEntry('elevation', 500, 1500)]);
  });

  it('replaces any existing entry for the same key', () => {
    const chain = [rangeEntry('elevation', 0, 100)];
    const next = stashOutgoing(
      chain,
      'elevation',
      getKey,
      rangeEntry('elevation', 500, 1500),
    );
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe('500 to 1500');
  });

  it('returns the chain unchanged (same reference) when entry is null', () => {
    const chain = [categoryEntry('landcover', 'Forest')];
    const next = stashOutgoing(chain, 'elevation', getKey, null);
    expect(next).toBe(chain);
  });

  it('leaves an unrelated stale entry for the outgoing key untouched when entry is null', () => {
    const chain = [rangeEntry('elevation', 0, 100)];
    const next = stashOutgoing(chain, 'elevation', getKey, null);
    expect(next).toBe(chain);
    expect(next).toHaveLength(1);
  });
});

describe('popRestorable', () => {
  it('finds and removes the incoming key entry', () => {
    const chain = [
      rangeEntry('elevation', 500, 1500),
      categoryEntry('landcover', 'Forest'),
    ];
    const { chain: next, restored } = popRestorable(chain, 'landcover', getKey);
    expect(restored?.variableId).toBe('landcover');
    expect(next).toEqual([chain[0]]);
  });

  it('returns null restored and the same chain reference when key is absent', () => {
    const chain = [rangeEntry('elevation', 500, 1500)];
    const { chain: next, restored } = popRestorable(chain, 'landcover', getKey);
    expect(restored).toBeNull();
    expect(next).toBe(chain);
  });
});

describe('removeChainEntry / clearChainEntries', () => {
  it('removes a single entry by key', () => {
    const chain = [rangeEntry('a', 0, 1), rangeEntry('b', 0, 1)];
    const next = removeChainEntry(chain, 'a', getKey);
    expect(next.map((e) => e.variableId)).toEqual(['b']);
  });

  it('preserves reference identity when the key is not present', () => {
    const chain = [rangeEntry('a', 0, 1)];
    expect(removeChainEntry(chain, 'missing', getKey)).toBe(chain);
  });

  it('clears the whole chain, preserving identity when already empty', () => {
    const chain = [rangeEntry('a', 0, 1)];
    const cleared = clearChainEntries(chain);
    expect(cleared).toEqual([]);
    expect(clearChainEntries(cleared)).toBe(cleared);
  });
});

describe('buildChainDescriptionText', () => {
  const resolveMeta = (key: string) =>
    (
      ({
        elevation: { name: 'Elevation', units: 'm' },
        landcover: { name: 'Land Cover', units: null },
      }) as Record<string, { name: string; units: string | null }>
    )[key] ?? null;

  const formatOriginal = (e: Entry) =>
    (e.originalRanges ?? []).map((r) => `${r.start} to ${r.end}`).join('; ');
  const getIsCategorical = (e: Entry) => e.isCategorical;
  const getLabel = (e: Entry) => e.label;

  it('returns null for an empty chain', () => {
    expect(
      buildChainDescriptionText(
        [],
        getKey,
        getIsCategorical,
        getLabel,
        resolveMeta,
        formatOriginal,
      ),
    ).toBeNull();
  });

  it('formats a single numeric entry with units', () => {
    const chain = [rangeEntry('elevation', 500, 1500)];
    const text = buildChainDescriptionText(
      chain,
      getKey,
      getIsCategorical,
      getLabel,
      resolveMeta,
      formatOriginal,
    );
    expect(text).toBe('And filtering from 500 to 1500 m Elevation');
  });

  it('formats a categorical entry using label, not formatOriginal', () => {
    const chain = [categoryEntry('landcover', 'Forest')];
    const text = buildChainDescriptionText(
      chain,
      getKey,
      getIsCategorical,
      getLabel,
      resolveMeta,
      () => 'SHOULD_NOT_APPEAR',
    );
    expect(text).toBe('And filtering to only Forest Land Cover');
  });

  it('joins multiple chained entries with "and" under one prefix', () => {
    const chain = [
      rangeEntry('elevation', 500, 1500),
      categoryEntry('landcover', 'Forest'),
    ];
    const text = buildChainDescriptionText(
      chain,
      getKey,
      getIsCategorical,
      getLabel,
      resolveMeta,
      formatOriginal,
    );
    expect(text).toBe(
      'And filtering from 500 to 1500 m Elevation and to only Forest Land Cover',
    );
  });

  it('falls back to the raw key when metadata cannot be resolved', () => {
    const chain = [rangeEntry('unknown_var', 1, 2)];
    const text = buildChainDescriptionText(
      chain,
      getKey,
      getIsCategorical,
      getLabel,
      () => null,
      formatOriginal,
    );
    expect(text).toBe('And filtering from 1 to 2 unknown_var');
  });
});
