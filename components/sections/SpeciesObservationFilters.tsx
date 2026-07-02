// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SelectField } from '@/components/inputs/SelectField';
import { ThemedText } from '@/components/text/ThemedText';
import { Size } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type SpeciesObservationFiltersProps = {
  selectedPhenology: string | null;
  onPhenologyChange: (value: string | null) => void;
  phenologyCounts: Record<string, number> | null;
  disabled?: boolean;
};

export function SpeciesObservationFilters({
  selectedPhenology,
  onPhenologyChange,
  phenologyCounts,
  disabled = false,
}: SpeciesObservationFiltersProps) {
  const toNullable = React.useCallback(
    (value: string) => (value ? value : null),
    [],
  );

  const options = React.useMemo(() => {
    if (!phenologyCounts) return [{ label: 'All', value: '' }];
    const sorted = Object.entries(phenologyCounts).sort((a, b) => b[1] - a[1]);
    return [
      { label: 'All', value: '' },
      ...sorted.map(([key]) => ({
        label: `${key.charAt(0).toUpperCase()}${key.slice(1)}`,
        value: key,
      })),
    ];
  }, [phenologyCounts]);

  const isLoading = phenologyCounts === null;

  return (
    <View style={styles.container}>
      <ThemedText variant='subheading'>Extra Filters</ThemedText>
      <SelectField
        label='Phenology'
        placeholder={isLoading ? 'Loading…' : 'Select'}
        options={options}
        value={selectedPhenology ?? ''}
        onValueChange={(value) => onPhenologyChange(toNullable(value))}
        disabled={disabled || isLoading}
      />
    </View>
  );
}

export default SpeciesObservationFilters;

const styles = StyleSheet.create({
  container: {
    gap: Size.space.text.paragraph,
  },
});
