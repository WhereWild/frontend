import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import { SelectField } from '@/components/inputs/SelectField';
import { Tabs } from '@/components/tabs/Tabs';
import type { EnvironmentVariableOption } from './model';
import { isVariableCategorical } from './model';
import {
  formatWindowHours,
  isTemporalId,
  parseTemporalId,
  stripTemporalSuffix,
} from './temporalHelpers';

/** Props for the variable/category selector header above environment charts. */
type VariableSelectorHeaderProps = {
  /** Available variable category labels. */
  categories: string[];
  /** Currently selected category key. */
  selectedVariableCategory: string | null;
  /** Updates selected category key. */
  onCategoryChange: (category: string) => void;
  /** Variables shown in the selector for active category. */
  filteredVariables: EnvironmentVariableOption[];
  /** Currently selected environment variable id. */
  selectedVariable: string;
  /** Updates selected environment variable id. */
  onVariableChange: (variable: string) => void;
  /** Optional heading when selector is unavailable. */
  headingText: string | null;
  /** Optional metadata subtitle (counts/range text). */
  metaText: string | null;
};

/** Renders category tabs, variable selector, and contextual heading/meta text. */
export function VariableSelectorHeader({
  categories,
  selectedVariableCategory,
  onCategoryChange,
  filteredVariables,
  selectedVariable,
  onVariableChange,
  headingText,
  metaText,
}: VariableSelectorHeaderProps) {
  // Use split UI when at least one variable in the category has a time window.
  // This assumes a category will not mix live/current variables with temporal
  // aggregates that share the same base id.
  const isTemporalCategory = React.useMemo(
    () => filteredVariables.some((v) => isTemporalId(v.id)),
    [filteredVariables],
  );

  const parsedSelected = React.useMemo(
    () => (isTemporalCategory ? parseTemporalId(selectedVariable) : null),
    [isTemporalCategory, selectedVariable],
  );

  // Base options: temporal ones are deduplicated by baseId; non-temporal shown as-is.
  const temporalBaseOptions = React.useMemo(() => {
    if (!isTemporalCategory) return [];
    const seen = new Map<string, string>(); // key -> label
    for (const v of filteredVariables) {
      const parsed = parseTemporalId(v.id);
      if (parsed) {
        if (!seen.has(parsed.baseId)) {
          seen.set(parsed.baseId, stripTemporalSuffix(v.label));
        }
      } else {
        // Non-temporal variable: use the full id as key so it appears as its own entry.
        if (!seen.has(v.id)) {
          seen.set(v.id, v.label);
        }
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [isTemporalCategory, filteredVariables]);

  // The selected base key: baseId for temporal, full id for non-temporal.
  const selectedBaseKey =
    parsedSelected?.baseId ?? (isTemporalCategory ? selectedVariable : null);

  // Window options for the currently selected base, sorted ascending by hours.
  // Empty when the selected variable is non-temporal.
  const windowOptions = React.useMemo(() => {
    if (!isTemporalCategory || !selectedBaseKey) return [];
    return filteredVariables
      .flatMap((v) => {
        const p = parseTemporalId(v.id);
        return p && p.baseId === selectedBaseKey ? [{ p, id: v.id }] : [];
      })
      .sort((a, b) => a.p.windowHours - b.p.windowHours)
      .map(({ p, id }) => ({
        value: id,
        label: formatWindowHours(p.windowHours),
      }));
  }, [isTemporalCategory, selectedBaseKey, filteredVariables]);

  // When the base changes, switch to the first window for temporal bases,
  // or directly select the variable for non-temporal ones.
  const handleBaseChange = React.useCallback(
    (newBase: string) => {
      const firstWindow = filteredVariables
        .flatMap((v) => {
          const p = parseTemporalId(v.id);
          return p && p.baseId === newBase ? [{ p, id: v.id }] : [];
        })
        .sort((a, b) => a.p.windowHours - b.p.windowHours)[0];
      onVariableChange(firstWindow ? firstWindow.id : newBase);
    },
    [filteredVariables, onVariableChange],
  );

  return (
    <>
      {categories.length > 0 ? (
        <Tabs
          tabs={categories.map((cat) => ({ key: cat, label: cat }))}
          selectedKey={selectedVariableCategory ?? categories[0]}
          onSelectionChange={onCategoryChange}
          disableNativeHoverVisuals
          accessibilityLabel='Environment variable categories'
        />
      ) : null}

      <View style={styles.variableHeadingRow}>
        {filteredVariables.length ? (
          isTemporalCategory ? (
            <View style={styles.temporalSelectRow}>
              <View style={styles.temporalSelectItem}>
                <SelectField
                  variant='secondary'
                  options={temporalBaseOptions}
                  value={selectedBaseKey ?? temporalBaseOptions[0]?.value ?? ''}
                  onValueChange={handleBaseChange}
                  placeholder='Select variable'
                />
              </View>
              <View style={styles.temporalSelectItem}>
                <SelectField
                  variant='secondary'
                  options={windowOptions}
                  value={windowOptions.length > 0 ? selectedVariable : ''}
                  onValueChange={onVariableChange}
                  placeholder='No window'
                  disabled={windowOptions.length === 0}
                />
              </View>
            </View>
          ) : (
            <View style={styles.selectFieldContainer}>
              <SelectField
                variant='secondary'
                options={filteredVariables.map((option) => {
                  const isCategoricalVar = isVariableCategorical(option);
                  const units = option.units;
                  return {
                    value: option.id,
                    label:
                      !isCategoricalVar && units
                        ? `${option.label} (${units})`
                        : option.label,
                  };
                })}
                value={selectedVariable}
                onValueChange={onVariableChange}
                placeholder='Select environment variable'
              />
            </View>
          )
        ) : headingText ? (
          <ThemedText variant='heading'>{headingText}</ThemedText>
        ) : null}

        {metaText ? (
          <ThemedText variant='bodySmall' style={styles.metaText}>
            {metaText}
          </ThemedText>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  variableHeadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Size.space.text.line,
  },
  selectFieldContainer: {
    flexShrink: 0,
  },
  temporalSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
  temporalSelectItem: {
    flexShrink: 0,
  },
  metaText: {
    flexShrink: 0,
  },
});
