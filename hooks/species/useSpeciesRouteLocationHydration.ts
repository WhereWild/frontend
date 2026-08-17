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
  countryDone: boolean;
  countryMatch: string | null;
  stateDone: boolean;
  stateMatch: string | null;
  countyDone: boolean;
};

const EMPTY_STATE: HydrationState = {
  forGid: null,
  countryDone: false,
  countryMatch: null,
  stateDone: false,
  stateMatch: null,
  countyDone: false,
};

// GADM-style gids are dot-hierarchical (USA.45.18_1 nests under USA.45,
// which nests under USA) — an ancestor's gid is always a string prefix of
// its descendants', one dot-segment at a time.
const isAncestorOrSelf = (candidateGid: string, targetGid: string) =>
  targetGid === candidateGid || targetGid.startsWith(`${candidateGid}.`);

/** Hydrates the species page's country/state/county filters from a single
 * requested gid — e.g. a state or county gid — by prefix-matching it
 * against this species' own already-loading, taxon-scoped location
 * options one level at a time (country, then state, then county), so
 * there's no separate lookup endpoint whose gid namespace could
 * disagree. Silently does nothing at any level whose resolved gid isn't
 * actually one of this species' own options — this hook never forces a
 * selection the species has no observations for. */
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
    if (!routeLocationGid || state.countryDone || countryLoading) {
      return;
    }
    const match = countryOptions.find((option) =>
      isAncestorOrSelf(option.value, routeLocationGid),
    );
    state.countryDone = true;
    state.countryMatch = match?.value ?? null;
    if (match) {
      onCountryChange(match.value);
    }
  }, [routeLocationGid, countryOptions, countryLoading, onCountryChange]);

  React.useEffect(() => {
    const state = stateRef.current;
    if (
      !routeLocationGid ||
      !state.countryDone ||
      !state.countryMatch ||
      state.stateDone ||
      stateLoading
    ) {
      return;
    }
    const match = stateOptions.find((option) =>
      isAncestorOrSelf(option.value, routeLocationGid),
    );
    state.stateDone = true;
    state.stateMatch = match?.value ?? null;
    if (match) {
      onStateChange(match.value);
    }
  }, [routeLocationGid, stateOptions, stateLoading, onStateChange]);

  React.useEffect(() => {
    const state = stateRef.current;
    if (
      !routeLocationGid ||
      !state.stateDone ||
      !state.stateMatch ||
      state.countyDone ||
      countyLoading
    ) {
      return;
    }
    const match = countyOptions.find(
      (option) => option.value === routeLocationGid,
    );
    state.countyDone = true;
    if (match) {
      onCountyChange(match.value);
    }
  }, [routeLocationGid, countyOptions, countyLoading, onCountyChange]);
}
