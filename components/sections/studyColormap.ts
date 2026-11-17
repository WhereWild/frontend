// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The study's color scale: turns a StudyScheme (colormap, bounds, center pin,
// distribution-aware, observed luminance/saturation, ...) plus the variable and
// the species' observed range into the stops the dots are colored with and the
// range they span, and builds the legend for it.

import {
  COLORMAPS,
  stopsColormap,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  CENTER_F,
  COOLWARM_STOPS,
  CUSTOM_BOUNDS_F,
  DISTRIBUTION_STOP_COUNT,
  equalizedStops,
  globalHueObservedLumSatStops,
  sampleStops,
  TEMPERATURE_VARIABLE_IDS,
  GRAY_STOPS,
  SUMMER_STOPS,
  THEMATIC_STOPS,
  VIRIDIS_UPPER_STOPS,
  YLGN_STOPS,
  type StudyScheme,
} from '@/components/sections/studyColors';
import { cdfAt, VARIABLE_CDFS } from '@/components/sections/studyDistributions';
import type { EnvironmentVariableDefinition } from '@/data/types';

export type ObservedRange = { min: number; max: number };

export type StudyColormap = {
  stops: [number, number, number][];
  barSvgStops: { offset: string; color: string }[];
  /** The value range the stops span. */
  min: number;
  max: number;
};

const NAMED_STOPS: Record<
  Exclude<StudyScheme['colormap'], 'thematic'>,
  [number, number, number][]
> = {
  coolwarm: COOLWARM_STOPS,
  viridis: COLORMAPS.viridis.stops,
  plasma: COLORMAPS.plasma.stops,
  magma: COLORMAPS.magma.stops,
  ylgn: YLGN_STOPS,
  gray: GRAY_STOPS,
  viridisUpper: VIRIDIS_UPPER_STOPS,
  summer: SUMMER_STOPS,
};

/** Null while an input the scheme needs (e.g. the observed range) is missing. */
export const buildStudyColormap = (
  scheme: StudyScheme,
  variable: EnvironmentVariableDefinition,
  units: string,
  observedRange: ObservedRange | null,
): StudyColormap | null => {
  const { renderMin, renderMax } = variable;
  const baseStops =
    scheme.colormap === 'thematic'
      ? (THEMATIC_STOPS[variable.id] ?? COOLWARM_STOPS)
      : NAMED_STOPS[scheme.colormap];
  const globalRange =
    renderMin != null && renderMax != null
      ? { min: renderMin, max: renderMax }
      : null;
  const fToDisplay = (f: number) =>
    units === 'metric' ? ((f - 32) * 5) / 9 : f;
  const range =
    scheme.bounds === 'observed'
      ? observedRange
      : (scheme.bounds === 'custom' || scheme.bounds === 'custom2') &&
          TEMPERATURE_VARIABLE_IDS.includes(variable.id)
        ? {
            min: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].min),
            max: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].max),
          }
        : globalRange;
  if (!range) return null;
  // Distribution-aware: position = the value's share of global area within
  // `range` (needs this variable's CDF; falls back to linear without it).
  const cdf = scheme.distributionAware ? VARIABLE_CDFS[variable.id] : null;
  const toC = (v: number) => (units === 'metric' ? v : ((v - 32) * 5) / 9);
  // Base 0..1 position of a value within `range`: linear, or equal-area.
  const base = cdf
    ? (() => {
        const lo = cdfAt(cdf, toC(range.min));
        const span = cdfAt(cdf, toC(range.max)) - lo || 1;
        return (v: number) => (cdfAt(cdf, toC(v)) - lo) / span;
      })()
    : (v: number) => (v - range.min) / (range.max - range.min || 1);
  // Center pin: the colormap's middle lands on a fixed temperature, each
  // side interpolated linearly (in base position) out to the range ends.
  const centerValue =
    scheme.center !== 'none' && TEMPERATURE_VARIABLE_IDS.includes(variable.id)
      ? fToDisplay(CENTER_F[scheme.center])
      : null;
  const centerPos = centerValue != null ? base(centerValue) : null;
  const pinned = centerPos != null && centerPos > 0 && centerPos < 1;
  const position =
    cdf || pinned
      ? (v: number) => {
          const u = base(v);
          if (!pinned) return u;
          return u <= centerPos
            ? (0.5 * u) / centerPos
            : 0.5 + (0.5 * (u - centerPos)) / (1 - centerPos);
        }
      : null;
  if (!scheme.observedLumSat) {
    return {
      ...stopsColormap(
        position
          ? equalizedStops(baseStops, range.min, range.max, position)
          : baseStops,
      ),
      min: range.min,
      max: range.max,
    };
  }
  // Hue spans `range`; lightness/saturation span the observed range.
  if (!observedRange) return null;
  return {
    ...stopsColormap(
      globalHueObservedLumSatStops({
        globalStops: baseStops,
        globalMin: range.min,
        globalMax: range.max,
        observedMin: observedRange.min,
        observedMax: observedRange.max,
        shape: scheme.lumSatShape,
        channels: scheme.lumSatChannels,
        hueAtValue: position ?? undefined,
        stopCount: position ? DISTRIBUTION_STOP_COUNT : undefined,
      }),
    ),
    min: observedRange.min,
    max: observedRange.max,
  };
};

export type StudyLegend = {
  min: number;
  max: number;
  barSvgStops: { offset: string; color: string }[];
};

/** The legend: the colormap's own range, or only the part of it the species'
 * values cover (labelled with its local min/max) - the dots are colored the
 * same either way. */
export const buildStudyLegend = (
  colormap: StudyColormap,
  legendRange: 'colormap' | 'observed',
  observedRange: ObservedRange | null,
): StudyLegend => {
  const activeColormap = colormap;
  return legendRange === 'observed' && observedRange
    ? (() => {
        const count = 101;
        const span = activeColormap.max - activeColormap.min || 1;
        const slice = Array.from({ length: count }, (_, i) => {
          const v =
            observedRange.min +
            (i / (count - 1)) * (observedRange.max - observedRange.min);
          return sampleStops(
            activeColormap.stops,
            (v - activeColormap.min) / span,
          );
        });
        return {
          min: observedRange.min,
          max: observedRange.max,
          barSvgStops: stopsColormap(slice).barSvgStops,
        };
      })()
    : {
        min: activeColormap.min,
        max: activeColormap.max,
        barSvgStops: activeColormap.barSvgStops,
      };
};
