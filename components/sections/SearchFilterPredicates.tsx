// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconPlus, IconX } from '@/assets/icons';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { NumberSpinner } from '@/components/inputs/NumberSpinner';
import { RadioField } from '@/components/inputs/RadioField';
import {
  SelectField,
  type SelectOption,
} from '@/components/inputs/SelectField';
import { ThemedText } from '@/components/text/ThemedText';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { EnvironmentVariableDefinition } from '@/data/types';
import type {
  FilterOperator,
  FilterPredicate,
} from '@/hooks/search/filters/useSearchFilters.state';
import { useVariableGroupSelection } from '@/hooks/search/filters/useVariableGroupSelection';
import {
  FILTER_OPERATOR_OPTIONS,
  getStatMetricOptions,
  supportsCategoryFilter,
  toCategoryOptions,
} from '@/hooks/search/filters/searchFilterPredicateHelpers';

export type SearchFilterPredicatesProps = {
  predicates: FilterPredicate[];
  variableDefinitions: EnvironmentVariableDefinition[];
  onAddPredicate?: () => void;
  onRemovePredicate?: (id: string) => void;
  onUpdatePredicate?: (
    id: string,
    patch: Partial<Omit<FilterPredicate, 'id'>>,
  ) => void;
};

export function SearchFilterPredicates({
  predicates,
  variableDefinitions,
  onAddPredicate,
  onRemovePredicate,
  onUpdatePredicate,
}: SearchFilterPredicatesProps) {
  const variableOptions = React.useMemo<SelectOption[]>(
    () =>
      variableDefinitions.map((def) => ({
        label: def.name ?? def.id,
        value: def.id,
      })),
    [variableDefinitions],
  );
  const variableDefMap = React.useMemo(
    () => new Map(variableDefinitions.map((def) => [def.id, def])),
    [variableDefinitions],
  );

  return (
    <View style={styles.container}>
      <ThemedText variant='subheading'>Custom filters</ThemedText>
      {predicates.map((predicate) => (
        <SearchFilterPredicateRow
          key={predicate.id}
          predicate={predicate}
          variableOptions={variableOptions}
          variableDefinitions={variableDefinitions}
          variableDef={variableDefMap.get(predicate.variable)}
          onRemove={onRemovePredicate}
          onUpdate={onUpdatePredicate}
        />
      ))}
      <Button
        variant='neutral'
        size='medium'
        iconStart={<IconPlus />}
        onPress={onAddPredicate}
        style={styles.addButton}
      >
        Add filter
      </Button>
    </View>
  );
}

type SearchFilterPredicateRowProps = {
  predicate: FilterPredicate;
  variableOptions: SelectOption[];
  variableDefinitions: EnvironmentVariableDefinition[];
  variableDef?: EnvironmentVariableDefinition;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<Omit<FilterPredicate, 'id'>>) => void;
};

function SearchFilterPredicateRow({
  predicate,
  variableOptions,
  variableDefinitions,
  variableDef,
  onRemove,
  onUpdate,
}: SearchFilterPredicateRowProps) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const valueType = variableDef?.valueType ?? null;
  const canFilterByCategory = supportsCategoryFilter(valueType);
  const statMetricOptions = React.useMemo(
    () => getStatMetricOptions(valueType),
    [valueType],
  );
  const categoryOptions = React.useMemo(
    () => toCategoryOptions(variableDef?.legendClasses),
    [variableDef],
  );
  const isCategoryMode = predicate.mode === 'category' && canFilterByCategory;

  // Picking a new logical variable (not just a different time window or
  // aggregate of the same one) invalidates whatever metric/category was
  // selected for the old one, since its value type may differ entirely.
  const handleVariableChange = (value: string) => {
    onUpdate?.(predicate.id, {
      variable: value,
      metric: '',
      categoryId: '',
      mode: 'stat',
      asCount: false,
      value: null,
    });
  };

  const {
    baseVariableOptions,
    selectedBaseKey,
    windowOptions,
    climateAggOptions,
    onBaseChange,
  } = useVariableGroupSelection({
    variableOptions,
    variableDefinitions,
    selectedValue: predicate.variable,
    onSelectedValueChange: handleVariableChange,
  });

  const handleModeChange = (mode: FilterPredicate['mode']) => {
    onUpdate?.(predicate.id, { mode, metric: '', categoryId: '', value: null });
  };

  return (
    <View
      style={[
        styles.predicateRow,
        { borderTopColor: palette.border.default.default },
      ]}
    >
      <View style={styles.predicateRowHeader}>
        <ThemedText variant='body'>Filter</ThemedText>
        <IconButton
          icon={<IconX />}
          variant='subtle'
          size='small'
          accessibilityLabel='Remove filter'
          onPress={() => onRemove?.(predicate.id)}
        />
      </View>
      <SelectField
        label='Variable'
        placeholder='Select variable'
        value={selectedBaseKey}
        options={baseVariableOptions}
        onValueChange={onBaseChange}
      />
      {windowOptions.length > 0 && (
        <SelectField
          label='Time window'
          value={predicate.variable}
          options={windowOptions}
          onValueChange={handleVariableChange}
        />
      )}
      {climateAggOptions.length > 0 && (
        <SelectField
          label='Aggregate'
          value={predicate.variable}
          options={climateAggOptions}
          onValueChange={handleVariableChange}
        />
      )}
      {canFilterByCategory && (
        <View style={styles.modeRow}>
          <RadioField
            style={styles.modeOption}
            label='Summary stat'
            checked={predicate.mode === 'stat'}
            onValueChange={() => handleModeChange('stat')}
          />
          <RadioField
            style={styles.modeOption}
            label='Category share'
            checked={predicate.mode === 'category'}
            onValueChange={() => handleModeChange('category')}
          />
        </View>
      )}
      {isCategoryMode ? (
        <>
          <SelectField
            label='Category'
            placeholder='Select category'
            value={predicate.categoryId}
            options={categoryOptions}
            onValueChange={(value) =>
              onUpdate?.(predicate.id, { categoryId: value })
            }
          />
          <View style={styles.modeRow}>
            <RadioField
              style={styles.modeOption}
              label='Percentage'
              checked={!predicate.asCount}
              onValueChange={() =>
                onUpdate?.(predicate.id, { asCount: false, value: null })
              }
            />
            <RadioField
              style={styles.modeOption}
              label='Observation count'
              checked={predicate.asCount}
              onValueChange={() =>
                onUpdate?.(predicate.id, { asCount: true, value: null })
              }
            />
          </View>
        </>
      ) : (
        <SelectField
          label='Metric'
          placeholder='Select metric'
          disabled={!predicate.variable}
          value={predicate.metric}
          options={statMetricOptions}
          onValueChange={(value) => onUpdate?.(predicate.id, { metric: value })}
        />
      )}
      <SelectField
        label='Condition'
        value={predicate.op}
        options={FILTER_OPERATOR_OPTIONS}
        onValueChange={(value) =>
          onUpdate?.(predicate.id, { op: value as FilterOperator })
        }
      />
      <NumberSpinner
        label='Value'
        description={
          isCategoryMode
            ? predicate.asCount
              ? 'Raw observation count in this category.'
              : 'Percentage of this taxon’s observations in this category (0–100).'
            : 'Threshold to compare against.'
        }
        value={predicate.value ?? 0}
        min={isCategoryMode ? 0 : undefined}
        max={isCategoryMode && !predicate.asCount ? 100 : undefined}
        onValueChange={(value) => onUpdate?.(predicate.id, { value })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space.text.paragraph,
  },
  predicateRow: {
    gap: Size.space.text.line,
    paddingTop: Size.space['200'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  predicateRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space.text.line,
  },
  modeOption: {
    flex: 1,
  },
  addButton: {
    alignSelf: 'flex-start',
  },
});
