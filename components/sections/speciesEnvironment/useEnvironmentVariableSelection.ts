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

  const resolvedVariables = React.useMemo(() => {
    if (variables && variables.length > 0) {
      return variables;
    }
    if (remoteVariables && remoteVariables.length > 0) {
      return remoteVariables;
    }
    return DEFAULT_VARIABLES;
  }, [remoteVariables, variables]);

  // Fallback selected variable id
  const fallbackVariable =
    variableId && variableId.length > 0 ? variableId : resolvedVariables[0]?.id ?? '';
  const [selectedVariable, setSelectedVariable] = React.useState(fallbackVariable);

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
    return resolvedVariables.filter((value) => value.category === selectedVariableCategory);
  }, [resolvedVariables, selectedVariableCategory, categories.length]);

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

  const selectedVariableMeta = React.useMemo(
    () =>
      resolvedVariables.find((option) => option.id === selectedVariable) ?? null,
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