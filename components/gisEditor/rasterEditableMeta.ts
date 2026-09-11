// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The user-editable half of a raster's metadata for /gis-editor: the
// measurement level (seeded from dataTypeDetection's guess, but always
// overridable), render bounds + units for continuous/circular data, and a
// named/colored legend class per distinct value for nominal/ordinal data.
// Shaped so toEnvironmentVariableOption() below produces exactly the same
// EnvironmentVariableOption fields a real catalog variable has — this is
// the schema a future custom-GIS-layer upload path would need to fill in.

import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import type { DetectedValueType, ValueTypeGuess } from './dataTypeDetection';
import { defaultClassColor, defaultOrdinalColor } from './paletteColors';
import type { RenderBounds } from './rasterMetadata';

export type EditableClass = {
  value: number;
  name: string;
  /** Always set by default (nominal: an evenly spaced hue; ordinal: a
   * sequential colormap sampled by rank — see paletteColors.ts), but only
   * nominal exposes a picker for it in the editor; ordinal's rank order is
   * the thing that carries meaning; the color is a rendering default the
   * user doesn't hand-pick. */
  color: string | null;
};

export type RasterEditableMeta = {
  valueType: ValueTypeGuess;
  units: string;
  renderMin: number;
  renderMax: number;
  /** Empty for interval/ratio/circular — legend classes only apply to
   * nominal/ordinal data. */
  classes: EditableClass[];
};

const classColorFor = (
  valueType: ValueTypeGuess,
  index: number,
  total: number,
): string | null => {
  if (valueType === 'nominal') return defaultClassColor(index, total);
  if (valueType === 'ordinal') return defaultOrdinalColor(index, total);
  return null;
};

const classesFor = (
  detectedType: DetectedValueType | null,
  valueType: ValueTypeGuess,
): EditableClass[] => {
  const values = detectedType?.distinctValues ?? [];
  return values.map((value, i) => ({
    value,
    name: String(value),
    color: classColorFor(valueType, i, values.length),
  }));
};

// Aspect/bearing-style circular data is overwhelmingly measured in degrees,
// so that's the default full-period render range — a cyclic colormap only
// wraps correctly when the render bounds span exactly one full period, which
// the raw sampled min/max usually won't (e.g. 12°–350° rather than 0°–360°).
// Radians data needs the user to change this to 0–6.283 themselves; there's
// no reliable way to tell the two apart from pixel values alone.
const DEFAULT_CIRCULAR_RENDER_RANGE: [number, number] = [0, 360];

export const buildInitialEditableMeta = (
  detectedType: DetectedValueType | null,
  bounds: RenderBounds,
): RasterEditableMeta => {
  const valueType = detectedType?.guess ?? 'ratio';
  const [renderMin, renderMax] =
    valueType === 'circular'
      ? DEFAULT_CIRCULAR_RENDER_RANGE
      : [bounds.min, bounds.max];
  return {
    valueType,
    units: '',
    renderMin,
    renderMax,
    classes: classesFor(detectedType, valueType),
  };
};

/**
 * Applies a manual data-type override. Re-derives the class list from the
 * detected distinct values whenever the class set for the new type would
 * otherwise be empty (e.g. switching from a continuous guess to nominal) so
 * switching types doesn't silently discard a legend the user already edited.
 */
export const withValueType = (
  editable: RasterEditableMeta,
  nextType: ValueTypeGuess,
  detectedType: DetectedValueType | null,
): RasterEditableMeta => {
  if (nextType === editable.valueType) return editable;
  const wasCategorical =
    editable.valueType === 'nominal' || editable.valueType === 'ordinal';
  const isCategorical = nextType === 'nominal' || nextType === 'ordinal';

  let classes = editable.classes;
  if (isCategorical && !wasCategorical) {
    classes = classesFor(detectedType, nextType);
  } else if (isCategorical && wasCategorical) {
    // Nominal <-> ordinal: keep the names, re-derive the (non-editable
    // either way for ordinal, so always safe to overwrite) default colors.
    classes = classes.map((c, i) => ({
      ...c,
      color: classColorFor(nextType, i, classes.length),
    }));
  }

  const wasCircular = editable.valueType === 'circular';
  const isCircular = nextType === 'circular';
  const [renderMin, renderMax] =
    isCircular && !wasCircular
      ? DEFAULT_CIRCULAR_RENDER_RANGE
      : [editable.renderMin, editable.renderMax];

  return { ...editable, valueType: nextType, classes, renderMin, renderMax };
};

export const toEnvironmentVariableOption = (
  fileName: string,
  version: number,
  editable: RasterEditableMeta,
): EnvironmentVariableOption => ({
  id: 'local-raster',
  label: fileName,
  units: editable.units.trim() || null,
  valueType: editable.valueType,
  category: 'Local raster',
  sourceIds: [],
  legendClasses:
    editable.classes.length > 0
      ? editable.classes.map((c) => ({
          id: c.value,
          name: c.name,
          color: c.color ?? undefined,
        }))
      : null,
  renderMin: editable.renderMin,
  renderMax: editable.renderMax,
  version,
});

/**
 * Reflects the current editor state back as a DetectedValueType, for
 * anything downstream (cogFixCommand's resampling suggestion) that should
 * follow the user's final choice rather than the raw auto-detected guess.
 */
export const editableMetaToDetectedType = (
  editable: RasterEditableMeta,
): DetectedValueType => ({
  guess: editable.valueType,
  confidence: 'high',
  reason: 'Manually selected in the metadata editor.',
  distinctCount: editable.classes.length > 0 ? editable.classes.length : null,
  distinctValues:
    editable.classes.length > 0 ? editable.classes.map((c) => c.value) : null,
});
