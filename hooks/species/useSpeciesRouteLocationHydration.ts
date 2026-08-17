// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { LocationOption } from './locationHelpers';

type UseSpeciesRouteLocationHydrationParams = {
  /** Requested gid from the route, e.g. /species/<id>/<slug>?location=<gid>. */
  routeLocationGid?: string;
  countryOptions: LocationOption[];
  countryLoading: boolean;
  stateOptions: LocationOption[];
  stateLoading: boolean;
  countyOptions: LocationOption[];
  countyLoading: boolean;
  onCountryChange: (gid: string | null) => void;
  onStateChange: (gid: string | null) => void;
  onCountyChange: (gid: string | null) => void;
};

type HydrationState = {
  forGid: string | null;
  countryStarted: boolean;
  countryDone: boolean;
  countryMatch: string | null;
  stateStarted: boolean;
  stateDone: boolean;
  stateMatch: string | null;
  countyStarted: boolean;
  countyDone: boolean;
};

const EMPTY_STATE: HydrationState = {
  forGid: null,
  countryStarted: false,
  countryDone: false,
  countryMatch: null,
  stateStarted: false,
  stateDone: false,
  stateMatch: null,
  countyStarted: false,
  countyDone: false,
};

// GADM-style gids are dot-hierarchical (USA.45.18_1 nests under USA.45_1,
// which nests under USA), but the trailing `_N` content-version suffix
// only ever appears once, at the very end of the deepest segment — not
// after every level — so "USA.45_1" is NOT a string-prefix of
// "USA.45.18_1" even though it IS its state. Strip the suffix before
// comparing dot-segments.
const stripVersionSuffix = (gid: string) => gid.replace(/_\d+$/, '');

const isAncestorOrSelf = (candidateGid: string, targetGid: string) => {
  const candidateBase = stripVersionSuffix(candidateGid);
  const targetBase = stripVersionSuffix(targetGid);
  return (
    targetBase === candidateBase || targetBase.startsWith(`${candidateBase}.`)
  );
};

/** Hydrates the species page's country/state/county filters from a single
 * requested gid — e.g. a state or county gid — by prefix-matching it
 * against this species' own already-loading, taxon-scoped location
 * options one level at a time (country, then state, then county), so
 * there's no separate lookup endpoint whose gid namespace could
 * disagree. Silently does nothing at any level whose resolved gid isn't
 * actually one of this species' own options — this hook never forces a
 * selection the species has no observations for.
 *
 * Each level waits for a genuine `loading: true -> false` cycle before
 * treating an empty options list as "settled, no match" — the loading
 * flag starts `false` (before the sibling hook that owns it has run its
 * own kickoff effect), so reacting to `!loading` on its own would treat
 * "hasn't started yet" as "finished empty" and give up before the real
 * fetch ever ran. */
export function useSpeciesRouteLocationHydration({
  routeLocationGid,
  countryOptions,
  countryLoading,
  stateOptions,
  stateLoading,
  countyOptions,
  countyLoading,
  onCountryChange,
  onStateChange,
  onCountyChange,
}: UseSpeciesRouteLocationHydrationParams) {
  const stateRef = React.useRef<HydrationState>(EMPTY_STATE);

  if (stateRef.current.forGid !== (routeLocationGid ?? null)) {
    stateRef.current = { ...EMPTY_STATE, forGid: routeLocationGid ?? null };
  }

  React.useEffect(() => {
    const state = stateRef.current;
    if (countryLoading) {
      state.countryStarted = true;
    }
    if (
      !routeLocationGid ||
      state.countryDone ||
      countryLoading ||
      !state.countryStarted
    ) {
      console.warn('[species] country: skip', {
        routeLocationGid,
        countryDone: state.countryDone,
        countryLoading,
        countryStarted: state.countryStarted,
      });
      return;
    }
    const match = countryOptions.find((option) =>
      isAncestorOrSelf(option.value, routeLocationGid),
    );
    state.countryDone = true;
    state.countryMatch = match?.value ?? null;
    console.warn('[species] country: resolved', {
      routeLocationGid,
      countryOptionValues: countryOptions.map((o) => o.value),
      match,
    });
    if (match) {
      onCountryChange(match.value);
    }
  }, [routeLocationGid, countryOptions, countryLoading, onCountryChange]);

  React.useEffect(() => {
    const state = stateRef.current;
    if (!state.countryDone || !state.countryMatch) {
      return;
    }
    if (stateLoading) {
      state.stateStarted = true;
    }
    if (
      !routeLocationGid ||
      state.stateDone ||
      stateLoading ||
      !state.stateStarted
    ) {
      console.warn('[species] state: skip', {
        routeLocationGid,
        stateDone: state.stateDone,
        stateLoading,
        stateStarted: state.stateStarted,
      });
      return;
    }
    const match = stateOptions.find((option) =>
      isAncestorOrSelf(option.value, routeLocationGid),
    );
    state.stateDone = true;
    state.stateMatch = match?.value ?? null;
    console.warn(
      '[species] state: resolved',
      JSON.stringify({
        routeLocationGid,
        stateOptionValues: stateOptions.map((o) => o.value),
        match,
      }),
    );
    if (match) {
      onStateChange(match.value);
    }
  }, [routeLocationGid, stateOptions, stateLoading, onStateChange]);

  React.useEffect(() => {
    const state = stateRef.current;
    if (!state.stateDone || !state.stateMatch) {
      return;
    }
    if (countyLoading) {
      state.countyStarted = true;
    }
    if (
      !routeLocationGid ||
      state.countyDone ||
      countyLoading ||
      !state.countyStarted
    ) {
      console.warn('[species] county: skip', {
        routeLocationGid,
        countyDone: state.countyDone,
        countyLoading,
        countyStarted: state.countyStarted,
      });
      return;
    }
    const match = countyOptions.find(
      (option) => option.value === routeLocationGid,
    );
    state.countyDone = true;
    console.warn(
      '[species] county: resolved',
      JSON.stringify({
        routeLocationGid,
        countyOptionValues: countyOptions.map((o) => o.value),
        match,
      }),
    );
    if (match) {
      onCountyChange(match.value);
    }
  }, [routeLocationGid, countyOptions, countyLoading, onCountyChange]);
}
