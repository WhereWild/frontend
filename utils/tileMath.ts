// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Must stay in sync with scripts/observation_ranks.py's _BANDS (the zoom
// half of each (zoom, cell_size_meters) tuple) in the backend repo — these
// are the only zoom values a minZoom<Level> column ever takes. A raw zoom
// strictly between two of these produces the exact same "which points are
// visible" answer as the band below it (minZoomKingdom <= 5 and <= 6 are
// identical to <= 4, since nothing has minZoom 5 or 6), so there is no
// reason to fetch new occurrence tiles for a raw zoom change that stays
// within one band — see bandZoomForRawZoom.
export const OCCURRENCE_BAND_ZOOMS: readonly number[] = [0, 4, 7, 10, 13, 15];

/**
 * The band zoom that governs which occurrence points are visible at
 * rawZoom — the largest band boundary at or below rawZoom (or the coarsest
 * band, for a rawZoom below every boundary). Multiple raw zooms map to the
 * same band zoom by design: that's what lets useSpeciesOccurrenceTiles skip
 * a re-fetch for a zoom change that doesn't cross a band boundary.
 */
export function bandZoomForRawZoom(rawZoom: number): number {
  let chosen = OCCURRENCE_BAND_ZOOMS[0];
  for (const band of OCCURRENCE_BAND_ZOOMS) {
    if (band > rawZoom) break;
    chosen = band;
  }
  return chosen;
}

/** Standard slippy-map lon/lat -> tile x/y at zoom z, clamped to the valid
 * [0, 2^z) range for that zoom (matches main.py's tile validation). */
export function deg2tile(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}
