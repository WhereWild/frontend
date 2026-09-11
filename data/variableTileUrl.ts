// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The GIS-variable tile URL, shared by the maps page and the GIS editor.
// `baseUrl` is the only thing that varies between them:
//   - remote: `${BACKEND_BASE}` — hits the real /api/variables/.../tiles endpoint
//   - local:  `localtiles:/`     — intercepted in the map template and answered
//             by a frontend tile renderer (see LOCAL_TILE_BRIDGE in
//             speciesOccurrenceMapHelpers.ts). The path + query are byte-identical
//             either way, so the local renderer reads the same params the backend
//             route does.

import type { UnitSystem } from '@/context/SettingsContext';
import type { LegendRange } from '@/components/sections/speciesOccurrenceMap/legendRangeSelection';
import type { MapChainExtra } from '@/components/sections/speciesOccurrenceMap/useMapLayerChain';

export type BuildVariableTileUrlArgs = {
  baseUrl: string;
  cacheKey: number | string;
  colormap: string;
  circularColormap: string;
  isCircular: boolean;
  cbMode: string | null;
  forecastH: number;
  variable: string;
  classFilter: number[] | null;
  valueRanges: LegendRange[] | null;
  unitSystem: UnitSystem | undefined;
  chain?: MapChainExtra[];
  // "Auto-adapt" mode's discovered [min,max] (display units, from GET
  // .../tile-range/stats) — overrides the layer's fixed catalog
  // render_min/max for colorization. See main.py's render_range query param.
  renderRange?: [number, number] | null;
};

export const buildVariableTileUrl = ({
  baseUrl,
  cacheKey,
  colormap,
  circularColormap,
  isCircular,
  cbMode,
  forecastH,
  variable,
  classFilter,
  valueRanges,
  unitSystem,
  chain,
  renderRange,
}: BuildVariableTileUrlArgs): string => {
  const effectiveColormap = isCircular ? circularColormap : colormap;
  const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
  const fcParam = forecastH > 0 ? `&forecast_h=${forecastH}` : '';
  // Repeated params (class_filter=1&class_filter=2) — FastAPI's
  // `list[int] = Query(None)` collects these the same way it does for any
  // other repeated-key query param.
  const cfParam =
    classFilter && classFilter.length > 0
      ? classFilter.map((id) => `&class_filter=${id}`).join('')
      : '';
  // value_ranges come from the legend, which displays (and the user drags
  // across) values in the current unit system — the backend converts back
  // to raw/metric before masking. A single layer's own filter can be
  // multiple disjoint ranges (OR'd). unit_system is sent unconditionally
  // since a chained filter can need conversion even when the primary
  // (categorical) layer has no value range of its own.
  const vrParam =
    valueRanges && valueRanges.length > 0
      ? `&value_ranges=${encodeURIComponent(
          JSON.stringify(valueRanges.map((r) => [r.min, r.max])),
        )}`
      : '';
  const chainParam =
    chain && chain.length > 0
      ? `&chain=${encodeURIComponent(JSON.stringify(chain))}`
      : '';
  const renderRangeParam = renderRange
    ? `&render_range=${encodeURIComponent(JSON.stringify(renderRange))}`
    : '';
  return `${baseUrl}/api/variables/${encodeURIComponent(
    variable || 'landcover',
  )}/tiles/{z}/{x}/{y}.png?reproject=true&max_native_zoom=10&colormap=${encodeURIComponent(effectiveColormap)}${cbParam}&_cb=${cacheKey}${fcParam}${cfParam}${vrParam}&unit_system=${unitSystem ?? 'metric'}${chainParam}${renderRangeParam}`;
};
