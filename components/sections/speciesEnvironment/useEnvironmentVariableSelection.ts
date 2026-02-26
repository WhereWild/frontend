// useEnvironmentVariableSelection.tsx
import { fetchEnvironmentVariables } from '@/data/api';
import React from 'react';
import {
  DEFAULT_VARIABLES,
  EnvironmentVariableOption,
  isVariableCategorical as isVariableCategoricalOption,
  normalizeLabel,
} from './model';

/** Inputs for choosing and loading environment variable options. */
type UseEnvironmentVariableSelectionParams = {
  /** Initial variable id requested by parent screen/route. */
  variableId: string;
  /** Optional pre-supplied variable definitions. */
  variables?: EnvironmentVariableOption[];

  units?: 'metric' | 'imperial' | undefined;
};

/** Extended variable option with a resolved displayUnits for UI. */
type EnvVarWithDisplay = EnvironmentVariableOption & { displayUnits?: string | null };

/** Manages variable catalog loading, category filtering, and selected variable state. */
export function useEnvironmentVariableSelection({
  variableId,
  variables,
  units,
}: UseEnvironmentVariableSelectionParams) {
  const [remoteVariables, setRemoteVariables] =
    React.useState<EnvironmentVariableOption[] | null>(null);
  const [selectedVariableCategory, setSelectedVariableCategory] = React.useState<string | null>(
    null,
  );

  // Base resolvedVariables (from props, remote, or defaults)
  const resolvedVariables = React.useMemo(() => {
    if (variables && variables.length > 0) {
      return variables;
    }
    if (remoteVariables && remoteVariables.length > 0) {
      return remoteVariables;
    }
    return DEFAULT_VARIABLES;
  }, [remoteVariables, variables]);

  // Helper: resolve a display-friendly unit string given whatever shape the backend/config uses.
  function resolveDisplayUnits(
    rawUnits: any, // backend might send string, or { metric, imperial }, or null
    unitsPref: 'metric' | 'imperial' | undefined,
  ): string | null {
    if (!rawUnits) return null;

    if (typeof rawUnits === 'string') {
      // Already a short label like 'mm' or 'C'
      return rawUnits;
    }

    if (typeof rawUnits === 'object') {
      // Prefer explicit match for user's pref
      if (unitsPref === 'imperial' && rawUnits.imperial) return rawUnits.imperial;
      if ((unitsPref === 'metric' || !unitsPref) && rawUnits.metric) return rawUnits.metric;

      // Fallbacks: metric, imperial, or first string-like property found
      const fallback = rawUnits.metric ?? rawUnits.imperial;
      if (fallback) return fallback;

      const values = Object.values(rawUnits).filter((v) => typeof v === 'string' && v.length > 0);
      return (values[0] as string) ?? null;
    }

    return null;
  }

  // Attach a displayUnits field to each resolved variable (used by the UI to show parentheses)
  const resolvedVariablesWithDisplayUnits: EnvVarWithDisplay[] = React.useMemo(() => {
    return resolvedVariables.map((v) => ({
      ...v,
      displayUnits: resolveDisplayUnits((v as any).units, units),
    }));
  }, [resolvedVariables, units]);

  // Fallback selected variable id
  const fallbackVariable =
    variableId && variableId.length > 0 ? variableId : resolvedVariablesWithDisplayUnits[0]?.id ?? '';
  const [selectedVariable, setSelectedVariable] = React.useState(fallbackVariable);

  React.useEffect(() => {
    setSelectedVariable(fallbackVariable);
  }, [fallbackVariable]);

  // Categories derived from the variables (now using the augmented array)
  const categories = React.useMemo(() => {
    const categorySet = new Set<string>();
    resolvedVariablesWithDisplayUnits.forEach((variable) => {
      if (variable.category) {
        categorySet.add(variable.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [resolvedVariablesWithDisplayUnits]);

  // Filtered variables (keeps displayUnits available on each item)
  const filteredVariables = React.useMemo(() => {
    if (!selectedVariableCategory || !categories.length) {
      return resolvedVariablesWithDisplayUnits;
    }
    return resolvedVariablesWithDisplayUnits.filter((value) => value.category === selectedVariableCategory);
  }, [resolvedVariablesWithDisplayUnits, selectedVariableCategory, categories.length]);

  React.useEffect(() => {
    if (!categories.length) {
      return;
    }
    if (selectedVariableCategory && categories.includes(selectedVariableCategory)) {
      return;
    }
    setSelectedVariableCategory(categories[0]);
  }, [categories, selectedVariableCategory]);

  React.useEffect(() => {
    if (!selectedVariableCategory || !filteredVariables.length) {
      return;
    }
    if (filteredVariables.some((variable) => variable.id === selectedVariable)) {
      return;
    }
    setSelectedVariable(filteredVariables[0].id);
  }, [selectedVariableCategory, filteredVariables, selectedVariable]);

  // Load remote vars when units or other deps change
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchEnvironmentVariables({ units });
        if (!cancelled && response.length) {
          const mapped: EnvironmentVariableOption[] = response.map((variableDefinition) => ({
            id: variableDefinition.id,
            label: variableDefinition.name ?? normalizeLabel(variableDefinition.id),
            units: variableDefinition.units ?? null,
            valueType: variableDefinition.valueType ?? null,
            category: variableDefinition.category ?? null,
          }));
          setRemoteVariables(mapped);
        }
      } catch (err) {
        console.warn('Failed to load variable catalog', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [units]);

  // selectedVariableMeta now comes from the augmented variables so it includes displayUnits
  const selectedVariableMeta = React.useMemo(
    () =>
      (resolvedVariablesWithDisplayUnits.find((option) => option.id === selectedVariable) ??
        null) as EnvVarWithDisplay | null,
    [resolvedVariablesWithDisplayUnits, selectedVariable],
  );

  const isVariableCategorical = React.useMemo(() => {
    return isVariableCategoricalOption({
      id: selectedVariable ?? '',
      valueType: selectedVariableMeta?.valueType ?? null,
    });
  }, [selectedVariable, selectedVariableMeta]);

  // Optional debug: uncomment if you want to see what displayUnits get resolved to
  /*
  React.useEffect(() => {
    console.log('resolvedVariablesWithDisplayUnits', resolvedVariablesWithDisplayUnits);
  }, [resolvedVariablesWithDisplayUnits]);
  */

  return {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables, // items now include displayUnits
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta, // includes displayUnits
    isVariableCategorical,
  };
}