import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import { SelectField } from '@/components/inputs/SelectField';
import { Tabs } from '@/components/tabs/Tabs';
import type { EnvironmentVariableOption } from './model';
import { isVariableCategorical } from './model';

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
  return (
    <>
      {categories.length > 0 ? (
        <Tabs
          tabs={categories.map((cat) => ({ key: cat, label: cat }))}
          selectedKey={selectedVariableCategory ?? categories[0]}
          onSelectionChange={onCategoryChange}
          accessibilityLabel="Environment variable categories"
        />
      ) : null}

      <View style={styles.variableHeadingRow}>
        {filteredVariables.length ? (
          <SelectField
            variant="tertiary"
            options={filteredVariables.map((option) => {
              const isCategoricalVar = isVariableCategorical(option);
              const units = option.units;
              return {
                value: option.id,
                label: !isCategoricalVar && units ? `${option.label} (${units})` : option.label,
              };
            })}
            value={selectedVariable}
            onValueChange={onVariableChange}
            placeholder="Select environment variable"
          />
        ) : headingText ? (
          <ThemedText variant="heading">{headingText}</ThemedText>
        ) : null}

        {metaText ? <ThemedText variant="bodySmall">{metaText}</ThemedText> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  variableHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Size.space['200'],
  },
});
