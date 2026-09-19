// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The user-editable half of a shapefile's styling for /gis-editor — the
// vector counterpart of rasterEditableMeta.ts. Two styling modes: a single
// flat color for every feature, or a categorical color per distinct value
// of one chosen attribute field (mirroring a raster's nominal legend —
// same defaultClassColor() palette, same "user can repaint any swatch"
// model).

import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import { defaultClassColor } from './paletteColors';
import type { VectorField, VectorSavedConfig } from './shapefileMetadata';

export type VectorClass = { value: string; name: string; color: string };

export type VectorEditableMeta = {
  /** What this layer is called wherever it's shown. Empty means "use the
   * file name". */
  displayName: string;
  mode: 'single' | 'categorical';
  color: string;
  /** Which field categorical mode colors by — null in single mode, and
   * null in categorical mode until the user (or a restored save) picks
   * one. */
  field: string | null;
  classes: VectorClass[];
};

const DEFAULT_SINGLE_COLOR = '#3388ff'; // Leaflet's own default marker/path blue

/** Distinct values actually present for `field`, in first-seen order —
 * capped, same reasoning as a raster's distinct-value sampling: a field
 * that turns out to be closer to a unique ID than a category shouldn't
 * produce thousands of legend rows. */
const MAX_CATEGORICAL_CLASSES = 64;

export const distinctFieldValues = (
  features: { properties: Record<string, unknown> | null }[],
  field: string,
): string[] => {
  const seen = new Set<string>();
  for (const f of features) {
    const raw = f.properties?.[field];
    if (raw == null) continue;
    seen.add(String(raw));
    if (seen.size > MAX_CATEGORICAL_CLASSES) break;
  }
  return [...seen];
};

const classesFor = (values: string[]): VectorClass[] =>
  values.map((value, i) => ({
    value,
    name: value,
    color: defaultClassColor(i, values.length),
  }));

/** When re-opening a file this tool already saved, the real names/colors
 * come back from the file itself (see shapefileMetadata.ts's
 * readSavedConfig) instead of classesFor()'s generated defaults. */
const classesFromSaved = (saved: VectorSavedConfig['classes']): VectorClass[] =>
  saved.map((c) => ({ ...c }));

/** A vector file's attribute table is always this tool's stand-in for
 * "categorical data" — see VectorEditor.tsx's doc comment for why there's
 * no field/mode picker in the UI at all. Without a previously-saved field
 * to restore, this just picks the first column that looks like a real
 * category (VectorField.likelyCategorical) rather than leaving the user
 * with nothing styled until they intervene. */
const autoPickField = (fields: VectorField[]): string | null =>
  fields.find((f) => f.likelyCategorical)?.name ?? null;

export const buildInitialVectorEditableMeta = (
  fields: VectorField[],
  savedConfig: VectorSavedConfig | null,
  features: { properties: Record<string, unknown> | null }[],
): VectorEditableMeta => {
  // A saved field that no longer exists in this file's own attribute table
  // (edited outside this tool since the last save, or just corrupt WW_*
  // metadata) can't drive categorical mode — falls back to auto-picking one
  // instead, same as if there were no saved config at all.
  const savedFieldStillExists =
    savedConfig?.field != null &&
    fields.some((f) => f.name === savedConfig.field);
  if (savedConfig && (savedConfig.mode === 'single' || savedFieldStillExists)) {
    return {
      displayName: savedConfig.displayName ?? '',
      mode: savedConfig.mode,
      color: savedConfig.color ?? DEFAULT_SINGLE_COLOR,
      field: savedConfig.field,
      classes:
        savedConfig.classes.length > 0
          ? classesFromSaved(savedConfig.classes)
          : [],
    };
  }
  const base: VectorEditableMeta = {
    // Kept even when the saved field can't be restored -- the name has
    // nothing to do with which column the classes come from.
    displayName: savedConfig?.displayName ?? '',
    mode: 'single',
    color: DEFAULT_SINGLE_COLOR,
    field: null,
    classes: [],
  };
  const autoField = autoPickField(fields);
  return autoField ? withCategoricalField(base, autoField, features) : base;
};

/** Applies a manual switch to categorical mode for `field`, deriving a
 * fresh class list from the data's own distinct values — mirrors
 * rasterEditableMeta.ts's withValueType() re-deriving classes on a type
 * switch. Values already styled under the previous field are discarded;
 * there's no meaningful correspondence between two different fields'
 * categories to carry forward. */
export const withCategoricalField = (
  editable: VectorEditableMeta,
  field: string,
  features: { properties: Record<string, unknown> | null }[],
): VectorEditableMeta => ({
  ...editable,
  mode: 'categorical',
  field,
  classes: classesFor(distinctFieldValues(features, field)),
});

export const withSingleColor = (
  editable: VectorEditableMeta,
  color: string,
): VectorEditableMeta => ({ ...editable, mode: 'single', color });

export const withClassColor = (
  editable: VectorEditableMeta,
  value: string,
  color: string,
): VectorEditableMeta => ({
  ...editable,
  classes: editable.classes.map((c) =>
    c.value === value ? { ...c, color } : c,
  ),
});

export const withClassName = (
  editable: VectorEditableMeta,
  value: string,
  name: string,
): VectorEditableMeta => ({
  ...editable,
  classes: editable.classes.map((c) =>
    c.value === value ? { ...c, name } : c,
  ),
});

/**
 * Maps a distinct field value to the synthetic integer class id
 * vectorTileRenderer.ts's rasterizer and VariableHeatmapMap's (numeric-id-
 * only) legend/classFilter both key on — see vectorTileRenderer.ts's doc
 * comment for why an id, not the raw string, is what actually flows
 * through the shared raster pipeline. Single-color mode has no field at
 * all, so every feature is treated as one synthetic class, id 0.
 */
export const vectorClassIndex = (
  editable: VectorEditableMeta,
): Map<string, number> =>
  editable.mode === 'categorical'
    ? new Map(editable.classes.map((c, i) => [c.value, i]))
    : new Map();

/** Same EnvironmentVariableOption shape rasterEditableMeta.ts's
 * toEnvironmentVariableOption() builds for a raster — this is what lets
 * the vector path drive the exact same VariableHeatmapMap (legend,
 * classFilter toggling, opacity, click-to-read-a-value) instead of a
 * separate implementation. Single-color mode still gets one legend class
 * ("All features") rather than no legend at all, since it's the same
 * underlying mechanism (an id -> color lookup) either way.
 */
export const toVectorVariableMeta = (
  fileNameBase: string,
  version: number,
  editable: VectorEditableMeta,
): EnvironmentVariableOption => ({
  id: 'local-vector',
  label: editable.displayName.trim() || fileNameBase,
  units: null,
  valueType: 'nominal',
  category: 'Local vector',
  sourceIds: [],
  legendClasses:
    editable.mode === 'categorical'
      ? editable.classes.map((c, i) => ({
          id: i,
          name: c.name,
          color: c.color,
        }))
      : [{ id: 0, name: 'All features', color: editable.color }],
  renderMin: null,
  renderMax: null,
  version,
});
