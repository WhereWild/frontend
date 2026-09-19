// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared class-coloring resolution for every occurrence/heatmap map that
// shows a categorical variable's legend and/or per-class dot colors --
// VariableHeatmapMap.tsx (/maps, /gis-editor), app/_species.tsx, and
// UploadPreview.tsx each render their own map, but all three need the
// exact same answer to "what color is class X right now", so that answer
// lives here once instead of three times (see the ordinal-legend bug this
// was extracted to fix: the upload page's dots and legend used to disagree
// with the selected colormap because only one of two near-identical inline
// copies of this logic had been patched).

import React from 'react';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import { getCbColor, type CbMode } from './cbColors';
import { sampleColormap, type ColormapId } from './variableColors';

export const isVariableOrdinal = (
  meta: EnvironmentVariableOption | null | undefined,
): boolean => meta?.valueType?.toLowerCase() === 'ordinal';

/** Category distributions built from tall-format stats rows (see
 * uploadLocalSpeciesDataSource.build.ts) key each class by its raw metric
 * name, e.g. "class_3", not a bare number -- Number("class_3") is NaN, which
 * would otherwise silently defeat every ordinal fallback/lookup keyed on
 * classId below. Strip the prefix before coercing, same as
 * StackedCategoryBar.tsx's own pill/segment classId parsing. */
export const parseClassId = (rawId: number | string): number =>
  typeof rawId === 'string' && rawId.startsWith('class_')
    ? Number(rawId.slice(6))
    : Number(rawId);

/** Ordinal has no colorblind-mode variant of its own -- the currently
 * selected continuous colormap IS its coloring mechanism, always on
 * (unlike cbMode, an opt-in accessibility toggle for nominal variables).
 * See util/tiles.py's matching branch for the raster tile side. */
export const resolveColorMode = (
  isOrdinalVariable: boolean,
  selectedColormap: ColormapId,
  cbMode: CbMode | null | undefined,
): CbMode | null | undefined => (isOrdinalVariable ? selectedColormap : cbMode);

/** Per-class-id fallback-color resolver: for a real catalog variable,
 * getCbColor's CB_CLASS_COLORS table already has a precomputed color for
 * every (variable, colormap, classId) combination (see
 * scripts/gen_colors.py), but a variable outside that catalog -- any
 * custom layer today -- always misses that lookup, so getCbColor falls
 * through to whatever this returns. For ordinal, sampling the *currently
 * selected* colormap live, at this class's own position in the variable's
 * own render range, keeps that fallback matching whatever the map is
 * actually showing; a static legend color (frozen at whatever moment
 * /gis-editor first typed the file as ordinal) is only ever correct for
 * nominal, where per-class color is the real, intentional coloring
 * mechanism. */
export const useOrdinalFallbackColor = (
  isOrdinalVariable: boolean,
  selectedVariableMeta: EnvironmentVariableOption | null | undefined,
  selectedColormap: ColormapId,
): ((classId: number, fallback: string) => string) =>
  React.useCallback(
    (classId: number, fallback: string): string => {
      if (!isOrdinalVariable) return fallback;
      const rawRenderMin = selectedVariableMeta?.renderMin;
      const rawRenderMax = selectedVariableMeta?.renderMax;
      // Number.isFinite, not just a null check -- a class id that isn't a
      // real number (e.g. Number() of a non-numeric category value that
      // slipped in here despite isOrdinalVariable) or a NaN render bound
      // produces a non-finite normalized position, and sampleColormap
      // indexes its color table with that position directly -- an
      // out-of-bounds/NaN index reads past the array and crashes on
      // .toString() of undefined, not just "picks a weird color".
      if (
        !Number.isFinite(rawRenderMin) ||
        !Number.isFinite(rawRenderMax) ||
        !Number.isFinite(classId) ||
        rawRenderMax === rawRenderMin
      ) {
        return fallback;
      }
      const renderMin = rawRenderMin as number;
      const renderMax = rawRenderMax as number;
      return sampleColormap(
        selectedColormap,
        (classId - renderMin) / (renderMax - renderMin),
      );
    },
    [isOrdinalVariable, selectedVariableMeta, selectedColormap],
  );

/** Resolves one class's actual displayed color: the ordinal live-colormap
 * fallback first, then getCbColor's precomputed-catalog lookup on top of
 * it (which wins when it has a real entry for this variable; the ordinal
 * fallback otherwise). Used for both legend swatches and per-occurrence
 * dot coloring so the two always agree with each other and with the
 * selected colormap. */
export const resolveClassDisplayColor = (
  variableId: string,
  classId: number,
  colorMode: CbMode | null | undefined,
  rawColor: string | null | undefined,
  ordinalFallbackColor: (classId: number, fallback: string) => string,
): string => {
  const fallback = ordinalFallbackColor(classId, rawColor ?? '#888888');
  return colorMode
    ? getCbColor(variableId, classId, colorMode, fallback)
    : fallback;
};
