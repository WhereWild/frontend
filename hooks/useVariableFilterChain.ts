// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Generic "switch-to-chain" state transitions shared between the species
 * page (variables) and the maps page (layers): slice a filter on the
 * currently-selected thing, switch to a different one, and the old
 * selection sticks around as a chained/locked filter instead of being
 * discarded — switching back to it restores it as the live selection again.
 *
 * These are plain, stateless array transforms (no React state/effects of
 * their own, and no assumed entry shape — callers pass a `getKey` accessor)
 * so each caller can slot them into whatever state shape and effect timing
 * it already has. Species' useEnvironmentHighlights keeps its existing
 * ChainedVariableFilter shape (keyed by `variableId`); maps' useMapLayerChain
 * uses its own shape (keyed by `layerId`) — same transitions, no shared
 * entry type forced on either.
 */

/** Stash `entry` for `outgoingKey` into `chain` (replacing any existing
 * entry for that key first) — or return `chain` unchanged if `entry` is
 * null (nothing was selected on the outgoing key, so there's nothing to
 * stash; a stale existing entry for that key, if any, is deliberately left
 * alone rather than cleared here). */
export function stashOutgoing<T>(
  chain: T[],
  outgoingKey: string,
  getKey: (entry: T) => string,
  entry: T | null,
): T[] {
  if (!entry) {
    return chain;
  }
  return [...chain.filter((e) => getKey(e) !== outgoingKey), entry];
}

/** Find and remove `incomingKey`'s stashed entry, if any — the caller
 * applies it as the live selection when switching back to that key. */
export function popRestorable<T>(
  chain: T[],
  incomingKey: string,
  getKey: (entry: T) => string,
): { chain: T[]; restored: T | null } {
  const restored = chain.find((e) => getKey(e) === incomingKey) ?? null;
  return {
    chain: restored ? chain.filter((e) => getKey(e) !== incomingKey) : chain,
    restored,
  };
}

/** Remove one entry by key — preserves array reference identity (returns
 * the same `chain` instance) when the key isn't present, so callers can use
 * reference equality to skip redundant re-renders/effects. */
export function removeChainEntry<T>(
  chain: T[],
  key: string,
  getKey: (entry: T) => string,
): T[] {
  const next = chain.filter((e) => getKey(e) !== key);
  return next.length === chain.length ? chain : next;
}

/** Clear the whole chain — preserves reference identity when already empty. */
export function clearChainEntries<T>(chain: T[]): T[] {
  return chain.length === 0 ? chain : [];
}

/** Builds "And filtering from X to Y ... and to only Z" style copy from a
 * chain — one "And filtering" prefix, each entry joined by "and", no
 * separate line per entry. `resolveMeta` looks up the chained key's display
 * name/units (e.g. from a variable/layer catalog); `formatOriginal` renders
 * that one entry's own value text (a class name, "10 to 20", "310° to 45°",
 * etc.) — left to the caller since that varies by original-selection shape. */
export function buildChainDescriptionText<T>(
  chain: T[],
  getKey: (entry: T) => string,
  getIsCategorical: (entry: T) => boolean,
  getCategoryLabel: (entry: T) => string,
  resolveMeta: (key: string) => { name: string; units?: string | null } | null,
  formatOriginal: (entry: T) => string,
): string | null {
  if (chain.length === 0) {
    return null;
  }
  const clauses = chain.map((entry) => {
    const key = getKey(entry);
    const meta = resolveMeta(key);
    const name = meta?.name ?? key;
    if (getIsCategorical(entry)) {
      return `to only ${getCategoryLabel(entry)} ${name}`;
    }
    const unitsSuffix = meta?.units ? ` ${meta.units}` : '';
    return `from ${formatOriginal(entry)}${unitsSuffix} ${name}`;
  });
  return `And filtering ${clauses.join(' and ')}`;
}
