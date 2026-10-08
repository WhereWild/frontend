// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useOptionalSettings } from '@/context/SettingsContext';
import { fetchRankDensity } from '@/data/apiRankDensity';
import type { RankDensity, SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';

type RankDensityState = {
  density: RankDensity | null;
  loading: boolean;
  failed: boolean;
};

const IDLE: RankDensityState = { density: null, loading: false, failed: false };

/** Lazily fetches the cohort distribution behind a relative rank, only once
 * `enabled` (e.g. the rank box is being hovered). */
export function useRankDensity(
  rank: SpeciesEnvironmentRelativeRank | null | undefined,
  enabled: boolean,
): RankDensityState {
  const units = useOptionalSettings()?.units ?? null;
  const [state, setState] = React.useState<RankDensityState>(IDLE);
  const contextTaxonId = rank?.contextTaxonId;
  const contextRank = rank?.contextRank;
  const variable = rank?.variable;
  const metric = rank?.metric;

  React.useEffect(() => {
    if (!enabled || !contextTaxonId || !contextRank || !variable || !metric) {
      return;
    }
    let cancelled = false;
    setState({ density: null, loading: true, failed: false });
    fetchRankDensity({ contextTaxonId, contextRank, variable, metric, units })
      .then((density) => {
        if (!cancelled) setState({ density, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled)
          setState({ density: null, loading: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, contextTaxonId, contextRank, variable, metric, units]);

  return state;
}
