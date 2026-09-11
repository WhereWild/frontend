// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pure, dependency-free logic for judging whether a parsed GeoTIFF is a
// valid Cloud-Optimized GeoTIFF. Kept out of rasterMetadata.ts (which pulls
// in `geotiff`) so it can be unit-tested in isolation.

export type IfdSummary = {
  width: number;
  height: number;
  tiled: boolean;
  tileWidth?: number;
  tileHeight?: number;
};

export type CogCheck = {
  label: string;
  /** null = indeterminate (can't be verified client-side). */
  pass: boolean | null;
  detail: string;
};

export type CogDiagnostics = {
  isCog: boolean;
  checks: CogCheck[];
};

const isPow2ish = (n: number | undefined): boolean =>
  typeof n === 'number' && n >= 128 && n <= 1024 && (n & (n - 1)) === 0;

/**
 * `ifds[0]` is the full-resolution image; `ifds[1..]` are overviews, expected
 * largest-to-smallest (as GDAL writes them).
 */
export const deriveCogDiagnostics = (ifds: IfdSummary[]): CogDiagnostics => {
  const checks: CogCheck[] = [];
  const full = ifds[0];
  const overviews = ifds.slice(1);

  const tiledPass = Boolean(full?.tiled);
  checks.push({
    label: 'Internally tiled',
    pass: tiledPass,
    detail: tiledPass
      ? `${full.tileWidth ?? '?'}x${full.tileHeight ?? '?'} px tiles`
      : 'Image is stripped, not tiled - re-encode with tiling.',
  });

  const hasOverviews = overviews.length > 0;
  const fitsInOneTile =
    tiledPass &&
    full.width <= (full.tileWidth ?? 0) &&
    full.height <= (full.tileHeight ?? 0);
  checks.push({
    label: 'Has overviews',
    pass: hasOverviews || fitsInOneTile,
    detail: hasOverviews
      ? `${overviews.length} level${overviews.length === 1 ? '' : 's'}`
      : fitsInOneTile
        ? 'Image fits in a single tile - overviews not required.'
        : 'No reduced-resolution overviews - zoomed-out rendering will be slow.',
  });

  let decreasing = true;
  for (let i = 1; i < overviews.length; i += 1) {
    if (
      overviews[i].width * overviews[i].height >=
      overviews[i - 1].width * overviews[i - 1].height
    ) {
      decreasing = false;
      break;
    }
  }
  if (hasOverviews) {
    checks.push({
      label: 'Overviews ordered largest->smallest',
      pass: decreasing,
      detail: decreasing
        ? overviews.map((o) => `${o.width}x${o.height}`).join(', ')
        : 'Overview levels are not in decreasing-resolution order.',
    });
  }

  const tileSizeOk = !tiledPass || isPow2ish(full.tileWidth);
  checks.push({
    label: 'Power-of-two tile size',
    pass: tiledPass ? isPow2ish(full.tileWidth) : null,
    detail: !tiledPass
      ? 'N/A - image is not tiled.'
      : tileSizeOk
        ? `${full.tileWidth} px`
        : `${full.tileWidth} px - 256 or 512 is recommended.`,
  });

  checks.push({
    label: 'Directory-before-data byte layout',
    pass: null,
    detail:
      'Not verifiable from the browser - confirm with a COG validator if needed.',
  });

  const isCog =
    tiledPass && (hasOverviews || fitsInOneTile) && decreasing && tileSizeOk;
  return { isCog, checks };
};
