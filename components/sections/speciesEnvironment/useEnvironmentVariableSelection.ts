// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import React from 'react';
import {
  DEFAULT_VARIABLES,
  EnvironmentVariableOption,
  isVariableCategorical as isVariableCategoricalOption,
  normalizeLabel,
} from './model';
import { fetchEnvironmentVariables } from '@/data/apiVariableHelpers';

/** Inputs for choosing and loading environment variable options. */
type UseEnvironmentVariableSelectionParams = {
  /** Initial variable id requested by parent screen/route. */
  variableId: string;
  /** Optional pre-supplied variable definitions. */
  variables?: EnvironmentVariableOption[];

  units?: 'metric' | 'imperial' | undefined;
  /** Category names to exclude from the remote variable catalog. */
  excludeCategories?: string[];
  /** Remap category display names: { 'live weather': 'Recent Weather' } etc. Keys are normalized (lowercase). */
  remapCategories?: Record<string, string>;
};

const normalizeVariableCategory = (category: string | null | undefined) =>
  (category ?? '').trim().toLowerCase();

const shouldIncludeVariableCategory = (
  category: string | null | undefined,
  excludedCategories: Set<string>,
) => {
  if (!excludedCategories.size) {
    return true;
  }

  return !excludedCategories.has(normalizeVariableCategory(category));
};

const mapEnvironmentVariableOptions = (
  response: Awaited<ReturnType<typeof fetchEnvironmentVariables>>,
  excludedCategories: Set<string>,
  categoryRemap: Record<string, string>,
): EnvironmentVariableOption[] => {
  return response
    .filter((variableDefinition) =>
      shouldIncludeVariableCategory(
        variableDefinition.category,
        excludedCategories,
      ),
    )
    .map((variableDefinition) => {
      const normalizedCategory = normalizeVariableCategory(
        variableDefinition.category,
      );
      const remappedCategory =
        categoryRemap[normalizedCategory] ??
        variableDefinition.category ??
        null;
      return {
        id: variableDefinition.id,
        label: variableDefinition.name ?? normalizeLabel(variableDefinition.id),
        units: variableDefinition.units ?? null,
        valueType: variableDefinition.valueType ?? null,
        domain: variableDefinition.domain ?? null,
        category: remappedCategory,
        sourceIds: variableDefinition.sourceIds,
        legendClasses: variableDefinition.legendClasses ?? null,
        renderMin: variableDefinition.renderMin ?? null,
        renderMax: variableDefinition.renderMax ?? null,
        group: variableDefinition.group ?? null,
        groupLabel: variableDefinition.groupLabel ?? null,
      };
    });
};

/** Manages variable catalog loading, category filtering, and selected variable state. */
export function useEnvironmentVariableSelection({
  variableId,
  variables,
  units,
  excludeCategories,
  remapCategories,
}: UseEnvironmentVariableSelectionParams) {
  const speciesDataSource = useSpeciesDataSource();
  const [remoteVariables, setRemoteVariables] = React.useState<
    EnvironmentVariableOption[] | null
  >(null);
  const [selectedVariableCategory, setSelectedVariableCategoryState] =
    React.useState<string | null>(null);
  const excludedCategories = React.useMemo(
    () => new Set((excludeCategories ?? []).map(normalizeVariableCategory)),
    [excludeCategories],
  );
  const categoryRemap = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(remapCategories ?? {}).map(([k, v]) => [
          normalizeVariableCategory(k),
          v,
        ]),
      ),
    [remapCategories],
  );

  const resolvedVariables = React.useMemo(() => {
    if (variables && variables.length > 0) {
      return variables;
    }
    if (remoteVariables !== null) {
      return remoteVariables;
    }
    return DEFAULT_VARIABLES;
  }, [remoteVariables, variables]);

  // Fallback selected variable id
  const fallbackVariable =
    variableId && variableId.length > 0
      ? variableId
      : (resolvedVariables[0]?.id ?? '');
  const [selectedVariable, setSelectedVariable] =
    React.useState(fallbackVariable);

  React.useEffect(() => {
    setSelectedVariable(fallbackVariable);
  }, [fallbackVariable]);

  const categories = React.useMemo(() => {
    const categorySet = new Set<string>();
    resolvedVariables.forEach((variable) => {
      if (variable.category) {
        categorySet.add(variable.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [resolvedVariables]);

  const filteredVariables = React.useMemo(() => {
    if (!selectedVariableCategory || !categories.length) {
      return resolvedVariables;
    }
    return resolvedVariables.filter(
      (value) => value.category === selectedVariableCategory,
    );
  }, [resolvedVariables, selectedVariableCategory, categories.length]);

  React.useEffect(() => {
    if (!categories.length) {
      return;
    }
    if (
      selectedVariableCategory &&
      categories.includes(selectedVariableCategory)
    ) {
      return;
    }
    setSelectedVariableCategoryState(categories[0]);
  }, [categories, selectedVariableCategory]);

  React.useEffect(() => {
    if (!selectedVariableCategory || !filteredVariables.length) {
      return;
    }
    if (
      filteredVariables.some((variable) => variable.id === selectedVariable)
    ) {
      return;
    }
    setSelectedVariable(filteredVariables[0].id);
  }, [selectedVariableCategory, filteredVariables, selectedVariable]);

  const setSelectedVariableCategory = React.useCallback(
    (nextCategory: string) => {
      setSelectedVariableCategoryState((previousCategory) =>
        previousCategory === nextCategory ? previousCategory : nextCategory,
      );
    },
    [],
  );

  // Load remote vars when units or other deps change
  React.useEffect(() => {
    if (variables && variables.length > 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await speciesDataSource.fetchEnvironmentVariables({
          units,
        });
        if (cancelled) {
          return;
        }
        setRemoteVariables(
          mapEnvironmentVariableOptions(
            response,
            excludedCategories,
            categoryRemap,
          ),
        );
      } catch (err) {
        console.warn('Failed to load variable catalog', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryRemap, excludedCategories, speciesDataSource, units, variables]);

  const selectedVariableMeta = React.useMemo(
    () =>
      resolvedVariables.find((option) => option.id === selectedVariable) ??
      null,
    [resolvedVariables, selectedVariable],
  );

  const isVariableCategorical = React.useMemo(() => {
    return isVariableCategoricalOption({
      id: selectedVariable ?? '',
      valueType: selectedVariableMeta?.valueType ?? null,
    });
  }, [selectedVariable, selectedVariableMeta]);

  return {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta,
    isVariableCategorical,
  };
}
