// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import {
  formatWindowHours,
  parseTemporalId,
  stripTemporalSuffix,
} from '@/components/sections/speciesEnvironment/temporalHelpers';
import type { SelectOption } from '@/components';

export type VariableGroupInfo = {
  id: string;
  group?: string | null;
  groupLabel?: string | null;
  agg?: string | null;
  units?: string | null;
};

export const AGG_LABELS: Record<string, string> = {
  max: 'Maximum',
  mean: 'Mean',
  min: 'Minimum',
  range: 'Range',
};

export const AGG_ORDER = ['mean', 'min', 'max', 'range'];

export type UseVariableGroupSelectionParams = {
  /** Flat list of concrete, selectable variable ids (e.g. every windowed
   * variant of a temporal variable, every aggregate variant of a climate
   * group) — the same shape a plain <SelectField> would take before
   * grouping collapses it down to one row per logical variable. */
  variableOptions: SelectOption[];
  variableDefinitions: VariableGroupInfo[];
  /** The concrete selected variable id (e.g. "bio1_24h_mean"), not the base key. */
  selectedValue: string;
  onSelectedValueChange?: (value: string) => void;
};

export type UseVariableGroupSelectionResult = {
  /** One row per logical variable — temporal ids collapse to their base id,
   * climate-aggregate groups collapse to their group id. */
  baseVariableOptions: SelectOption[];
  /** The base/group key that should be shown selected in baseVariableOptions. */
  selectedBaseKey: string;
  /** Populated only when the selected base is a temporal variable. */
  windowOptions: SelectOption[];
  /** Populated only when the selected base is a climate-aggregate group. */
  climateAggOptions: SelectOption[];
  /** Handles a change on the base picker — resolves to a concrete variable id
   * (first time window, or the mean aggregate variant) and reports that. */
  onBaseChange: (newBase: string) => void;
};

/**
 * Groups a flat list of variable options into a Base variable → Time window
 * → Aggregate picker hierarchy, for variables that are actually many
 * concrete ids under the hood (e.g. "bio1_24h_mean", "bio1_7d_mean", or a
 * climate group with mean/min/max/range variants). Shared by the sort
 * variable picker and the custom filter predicate rows so both present the
 * same grouped experience instead of a flat list of every concrete id.
 */
export function useVariableGroupSelection({
  variableOptions,
  variableDefinitions,
  selectedValue,
  onSelectedValueChange,
}: UseVariableGroupSelectionParams): UseVariableGroupSelectionResult {
  const variableDefMap = React.useMemo(
    () => new Map(variableDefinitions.map((d) => [d.id, d])),
    [variableDefinitions],
  );

  const baseVariableOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const option of variableOptions) {
      const parsed = parseTemporalId(option.value);
      if (parsed) {
        if (!seen.has(parsed.baseId)) {
          seen.set(parsed.baseId, stripTemporalSuffix(option.label));
        }
      } else {
        const def = variableDefMap.get(option.value);
        if (def?.group && def?.agg) {
          if (!seen.has(def.group)) {
            const base = def.groupLabel ?? option.label;
            seen.set(def.group, def.units ? `${base} (${def.units})` : base);
          }
        } else if (!seen.has(option.value)) {
          seen.set(option.value, option.label);
        }
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [variableOptions, variableDefMap]);

  const parsedSelected = React.useMemo(
    () => parseTemporalId(selectedValue),
    [selectedValue],
  );

  const selectedDef = variableDefMap.get(selectedValue);
  const selectedBaseKey =
    parsedSelected?.baseId ??
    (selectedDef?.group && selectedDef?.agg ? selectedDef.group : selectedValue);

  const windowOptions = React.useMemo(() => {
    if (!parsedSelected || !selectedBaseKey) return [];
    return variableOptions
      .flatMap((option) => {
        const p = parseTemporalId(option.value);
        return p && p.baseId === selectedBaseKey
          ? [{ p, value: option.value }]
          : [];
      })
      .sort((a, b) => a.p.windowHours - b.p.windowHours)
      .map(({ p, value }) => ({
        value,
        label: `${formatWindowHours(p.windowHours)} (${p.agg})`,
      }));
  }, [parsedSelected, selectedBaseKey, variableOptions]);

  const climateAggOptions = React.useMemo(() => {
    if (!selectedDef?.group || !selectedDef?.agg) return [];
    const group = selectedDef.group;
    return variableOptions
      .filter((option) => {
        const d = variableDefMap.get(option.value);
        return d?.group === group && d?.agg;
      })
      .map((option) => {
        const d = variableDefMap.get(option.value)!;
        return { value: option.value, label: AGG_LABELS[d.agg!] ?? d.agg! };
      })
      .sort(
        (a, b) =>
          AGG_ORDER.indexOf(variableDefMap.get(a.value)?.agg ?? '') -
          AGG_ORDER.indexOf(variableDefMap.get(b.value)?.agg ?? ''),
      );
  }, [selectedDef, variableOptions, variableDefMap]);

  const onBaseChange = React.useCallback(
    (newBase: string) => {
      const firstWindow = variableOptions
        .flatMap((option) => {
          const p = parseTemporalId(option.value);
          return p && p.baseId === newBase ? [{ p, value: option.value }] : [];
        })
        .sort((a, b) => a.p.windowHours - b.p.windowHours)[0];
      if (firstWindow) {
        onSelectedValueChange?.(firstWindow.value);
        return;
      }
      const groupVariants = variableOptions.filter((option) => {
        const d = variableDefMap.get(option.value);
        return d?.group === newBase && d?.agg;
      });
      if (groupVariants.length > 0) {
        const meanVariant = groupVariants.find(
          (option) => variableDefMap.get(option.value)?.agg === 'mean',
        );
        onSelectedValueChange?.((meanVariant ?? groupVariants[0]).value);
        return;
      }
      onSelectedValueChange?.(newBase);
    },
    [variableOptions, variableDefMap, onSelectedValueChange],
  );

  return {
    baseVariableOptions,
    selectedBaseKey,
    windowOptions,
    climateAggOptions,
    onBaseChange,
  };
}
