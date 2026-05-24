import { SelectField } from '@/components/inputs/SelectField';
import { ThemedText } from '@/components/text/ThemedText';
import { Size } from '@/constants/theme';
import { usePhenologyOptions } from '@/hooks/species/usePhenologyOptions';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type SpeciesObservationFiltersProps = {
  selectedPhenology: string | null;
  onPhenologyChange: (value: string | null) => void;
};

export function SpeciesObservationFilters({
  selectedPhenology,
  onPhenologyChange,
}: SpeciesObservationFiltersProps) {
  const phenologyOptions = usePhenologyOptions();

  const toNullable = React.useCallback(
    (value: string) => (value ? value : null),
    [],
  );

  const options = React.useMemo(
    () => [{ label: 'All', value: '' }, ...phenologyOptions],
    [phenologyOptions],
  );

  return (
    <View style={styles.container}>
      <ThemedText variant='subheading'>Extra Filters</ThemedText>
      <SelectField
        label='Phenology'
        placeholder={phenologyOptions.length === 0 ? 'Loading…' : 'Select'}
        options={options}
        value={selectedPhenology ?? ''}
        onValueChange={(value) => onPhenologyChange(toNullable(value))}
        disabled={phenologyOptions.length === 0}
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
