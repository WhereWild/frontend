// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useState } from 'react';
import { BACKEND_BASE, type ViewportTileRange } from '@/data/api';

/**
 * "Auto-adapt" mode: rescales a numeric variable's legend/colorization to
 * just the value range actually visible on screen (via GET
 * .../tile-range/stats for the current viewport), instead of the variable's
 * fixed catalog-wide render_min/render_max. Off by default, session-only —
 * a deliberate per-visit choice, not a saved preference.
 *
 * Extracted from maps.tsx so the species page and upload-preview page (which
 * both also render a variable-colorized SpeciesOccurrenceMap) can offer the
 * same ruler-icon toggle without re-deriving this logic three times.
 *
 * autoRange only ever updates once a stats fetch for the CURRENT viewport
 * actually resolves — never set optimistically — which is what avoids a
 * flash of the wrong color while the real range is still loading: the map
 * keeps showing whatever was last correctly colored (catalog range, or the
 * previous viewport's auto range) right up until the new one is ready to
 * swap in atomically.
 */
export function useAutoAdaptRange({
  selectedVariable,
  isApplicable,
  units,
  forecastH,
  catalogRenderMin,
  catalogRenderMax,
  resetKey,
}: {
  selectedVariable: string | null | undefined;
  isApplicable: boolean;
  units: string | null | undefined;
  forecastH: number;
  catalogRenderMin: number | null | undefined;
  catalogRenderMax: number | null | undefined;
  // Extra value (besides selectedVariable) that resets the discovered range
  // when it changes — e.g. maps.tsx's globeViewEnabled, whose renderer swap
  // discards the whole map document.
  resetKey?: unknown;
}) {
  const [autoAdaptEnabled, setAutoAdaptEnabled] = useState(false);
  const [autoRange, setAutoRange] = useState<{
    min: number;
    max: number;
  } | null>(null);
  const [viewportBounds, setViewportBounds] =
    useState<ViewportTileRange | null>(null);

  const handleBoundsChange = useCallback(
    (bounds: ViewportTileRange) => setViewportBounds(bounds),
    [],
  );

  const toggleAutoAdapt = useCallback(() => setAutoAdaptEnabled((v) => !v), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAutoRange(null);
  }, [selectedVariable, resetKey]);

  // Discovers auto-adapt's colorization range for the CURRENT viewport —
  // debounced so a drag/zoom gesture doesn't fire a request per frame, and
  // only ever applied once the fetch actually resolves (see the doc comment
  // above). A stale response from a viewport the user has since panned away
  // from is dropped via the cancelled flag rather than clobbering a newer
  // one.
  useEffect(() => {
    if (!autoAdaptEnabled || !isApplicable || !viewportBounds || !selectedVariable) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        z: String(viewportBounds.z),
        x0: String(viewportBounds.x0),
        y0: String(viewportBounds.y0),
        x1: String(viewportBounds.x1),
        y1: String(viewportBounds.y1),
        unit_system: units ?? 'metric',
      });
      if (forecastH > 0) {
        params.set('forecast_h', String(forecastH));
      }
      fetch(
        `${BACKEND_BASE}/api/layers/${encodeURIComponent(selectedVariable)}/tile-range/stats?${params.toString()}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { min?: unknown; max?: unknown } | null) => {
          if (cancelled || !data) return;
          if (typeof data.min === 'number' && typeof data.max === 'number') {
            setAutoRange({ min: data.min, max: data.max });
          }
        })
        .catch(() => {
          // Transient failure — keep whatever range was last known rather
          // than blanking/reverting the legend for one bad request.
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    autoAdaptEnabled,
    isApplicable,
    viewportBounds,
    selectedVariable,
    units,
    forecastH,
  ]);

  const renderRange: [number, number] | null =
    isApplicable && autoAdaptEnabled && autoRange
      ? [autoRange.min, autoRange.max]
      : null;

  // Falls back to the catalog's fixed range whenever auto-adapt is off, or
  // on but not yet resolved for the current viewport — so toggling it on
  // never blanks the legend while the first stats request is still in
  // flight.
  const effectiveRenderMin =
    isApplicable && autoAdaptEnabled && autoRange
      ? autoRange.min
      : (catalogRenderMin ?? null);
  const effectiveRenderMax =
    isApplicable && autoAdaptEnabled && autoRange
      ? autoRange.max
      : (catalogRenderMax ?? null);

  return {
    autoAdaptEnabled,
    toggleAutoAdapt,
    handleBoundsChange,
    renderRange,
    effectiveRenderMin,
    effectiveRenderMax,
  };
}
