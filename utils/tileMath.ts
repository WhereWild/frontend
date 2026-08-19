// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Must stay in sync with scripts/observation_ranks.py's _BANDS (the zoom
// half of each (zoom, cell_size_meters) tuple) in the backend repo — these
// are the only zoom values a minZoom<Level> column ever takes. A raw zoom
// strictly between two of these produces the exact same "which points are
// visible" answer as the band below it (minZoomKingdom <= 2 and <= 3 are
// identical to <= 2 the same way, since nothing has minZoom 3), so there is
// no reason to fetch new occurrence tiles for a raw zoom change that stays
// within one band — see bandZoomForRawZoom.
export const OCCURRENCE_BAND_ZOOMS: readonly number[] = [0, 2, 4, 6, 8, 10];

/**
 * The tile zoom to fetch occurrences at for a given rawZoom.
 *
 * Below the finest band, this snaps down to the largest band boundary at or
 * below rawZoom (or the coarsest band, for a rawZoom below every boundary)
 * — the point SET genuinely doesn't change for a raw zoom change that
 * doesn't cross a band boundary, so there's no reason to fetch new tiles
 * for it (see useSpeciesOccurrenceTiles).
 *
 * At or above the finest band, snapping down would be actively wrong, not
 * just unnecessary: the finest band's minZoom already means "fully
 * unthinned" (every point that will ever be visible already is), so
 * further zooming in doesn't change WHICH points exist — but it does mean
 * the visible viewport keeps shrinking. Freezing the fetch at the finest
 * band's (coarse) zoom would keep requesting the same huge-area tile
 * regardless of how far in the user actually zooms, so the handful of
 * points that happen to fall inside the current tiny viewport get diluted
 * by however many hundreds more sit elsewhere in that same oversized tile
 * — confirmed live: deep zoom (~15) still requesting a single z=10 tile
 * (~150km across) with 221 points scattered across it, almost none of
 * which land on screen, reading as sparse even though the data itself was
 * never thinned further. Past the finest band, track rawZoom directly
 * (rounded to a whole tile zoom) instead, so tile size keeps shrinking
 * with the viewport — the point SET returned is identical either way, this
 * only changes how it's spatially partitioned into fetches.
 */
export function bandZoomForRawZoom(rawZoom: number): number {
  const finestBand = OCCURRENCE_BAND_ZOOMS[OCCURRENCE_BAND_ZOOMS.length - 1];
  if (rawZoom >= finestBand) {
    return Math.max(finestBand, Math.round(rawZoom));
  }
  let chosen = OCCURRENCE_BAND_ZOOMS[0];
  for (const band of OCCURRENCE_BAND_ZOOMS) {
    if (band > rawZoom) break;
    chosen = band;
  }
  return chosen;
}

/** Standard slippy-map lon/lat -> tile x/y at zoom z, clamped to the valid
 * [0, 2^z) range for that zoom (matches main.py's tile validation). */
export function deg2tile(
  lat: number,
  lon: number,
  z: number,
): { x: number; y: number } {
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
