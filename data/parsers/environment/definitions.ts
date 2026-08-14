// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EnvironmentVariableDefinition, LegendClass } from '../../types';
import { asRecord } from '../core';

const toVariableDefinition = (entry: unknown): EnvironmentVariableDefinition => {
  const source = asRecord(entry);
const rawSourceIds = source?.source_ids ?? source?.sourceIds;
  const sourceIds = Array.isArray(rawSourceIds)
    ? rawSourceIds.filter((v): v is string => typeof v === 'string')
    : undefined;
  const rawLegend = source?.legend_classes ?? source?.legendClasses;
  let legendClasses: LegendClass[] | null = null;
  if (Array.isArray(rawLegend) && rawLegend.length > 0) {
    const parsed: LegendClass[] = [];
    for (const item of rawLegend) {
      const e = asRecord(item);
      if (!e || (typeof e.id !== 'number' && typeof e.id !== 'string')) continue;
      parsed.push({
        id: e.id as number | string,
        name: typeof e.name === 'string' ? e.name : String(e.id),
        color: typeof e.color === 'string' ? e.color : undefined,
      });
    }
    if (parsed.length > 0) legendClasses = parsed;
  }

  return {
    id: String(source?.id ?? ''),
    name: typeof source?.name === 'string' ? source.name : undefined,
    units: typeof source?.units === 'string' ? source.units : null,
    description: typeof source?.description === 'string' ? source.description : undefined,
    valueType:
      typeof source?.value_type === 'string'
        ? source.value_type
        : typeof source?.valueType === 'string'
          ? source.valueType
          : null,
    rawValueType:
      typeof source?.raw_value_type === 'string'
        ? source.raw_value_type
        : typeof source?.rawValueType === 'string'
          ? source.rawValueType
          : null,
    domain: typeof source?.domain === 'string' ? source.domain : null,
    category: typeof source?.category === 'string' ? source.category : null,
    sourceIds: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
    legendClasses: legendClasses && legendClasses.length > 0 ? legendClasses : null,
    renderMin: typeof source?.render_min === 'number' ? source.render_min : typeof source?.renderMin === 'number' ? source.renderMin : null,
    renderMax: typeof source?.render_max === 'number' ? source.render_max : typeof source?.renderMax === 'number' ? source.renderMax : null,
    group: typeof source?.group === 'string' ? source.group : null,
    groupLabel: typeof source?.group_label === 'string' ? source.group_label : null,
    agg: typeof source?.agg === 'string' ? source.agg : null,
    version: typeof source?.version === 'number' ? source.version : null,
    compositionGroup:
      typeof source?.composition_group === 'string'
        ? source.composition_group
        : typeof source?.compositionGroup === 'string'
          ? source.compositionGroup
          : null,
    compositionAxis:
      source?.composition_axis === 'top' ||
      source?.composition_axis === 'bottom_left' ||
      source?.composition_axis === 'bottom_right'
        ? source.composition_axis
        : source?.compositionAxis === 'top' ||
            source?.compositionAxis === 'bottom_left' ||
            source?.compositionAxis === 'bottom_right'
          ? source.compositionAxis
          : null,
    compositionLabel:
      typeof source?.composition_label === 'string'
        ? source.composition_label
        : typeof source?.compositionLabel === 'string'
          ? source.compositionLabel
          : null,
  };
};

/**
 * Parses variable definition rows from backend payloads.
 */
export const parseEnvironmentVariableDefinitions = (payload: unknown): EnvironmentVariableDefinition[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(toVariableDefinition).filter((entry) => entry.id.length > 0);
};