// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SpeciesOccurrence } from '@/data/types';

export type ExtremeTarget = 'hottest' | 'coldest';

export type StudyPoint = {
  catalogNumber: string;
  lat: number;
  lon: number;
  /** The variable's value at this observation (display units), when known. */
  value: number | null;
};

export type StudySelection = {
  selected: StudyPoint;
  /** The observation that is actually the target extreme, when computable. */
  truth: StudyPoint | null;
  /** |selected - truth| in the variable's display units. */
  valueDiff: number | null;
  /** Great-circle distance from the selected observation to the truth one. */
  distanceKm: number | null;
};

const EARTH_RADIUS_KM = 6371;

export const haversineKm = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

/** The observation with the highest ('hottest') or lowest ('coldest') value. */
export const findTruth = (
  occurrences: SpeciesOccurrence[],
  values: Map<string, number> | null,
  target: ExtremeTarget,
): StudyPoint | null => {
  if (!values) return null;
  let best: StudyPoint | null = null;
  for (const occ of occurrences) {
    const key = String(occ.catalogNumber);
    const value = values.get(key);
    if (value == null) continue;
    const better =
      best == null ||
      (target === 'hottest'
        ? value > (best.value as number)
        : value < (best.value as number));
    if (better) {
      best = {
        catalogNumber: key,
        lat: occ.latitude,
        lon: occ.longitude,
        value,
      };
    }
  }
  return best;
};

export const scoreSelection = (
  selected: StudyPoint,
  truth: StudyPoint | null,
): StudySelection => ({
  selected,
  truth,
  valueDiff:
    truth && selected.value != null && truth.value != null
      ? Math.abs(selected.value - truth.value)
      : null,
  distanceKm: truth ? haversineKm(selected, truth) : null,
});
