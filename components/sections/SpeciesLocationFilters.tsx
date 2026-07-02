// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SelectField } from '@/components/inputs/SelectField';
import { ThemedText } from '@/components/text/ThemedText';
import { GadmAttribution } from './GadmAttribution';
import { Size } from '@/constants/theme';
import type { LocationOption } from '@/hooks/species/locationHelpers';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type SpeciesLocationFiltersProps = {
  countryOptions: LocationOption[];
  stateOptions: LocationOption[];
  countyOptions: LocationOption[];
  countryLoading: boolean;
  stateLoading: boolean;
  countyLoading: boolean;
  selectedCountryGid: string | null;
  selectedStateGid: string | null;
  selectedCountyGid: string | null;
  onCountryChange: (gid: string | null) => void;
  onStateChange: (gid: string | null) => void;
  onCountyChange: (gid: string | null) => void;
  disabled?: boolean;
};

export function SpeciesLocationFilters({
  countryOptions,
  stateOptions,
  countyOptions,
  countryLoading,
  stateLoading,
  countyLoading,
  selectedCountryGid,
  selectedStateGid,
  selectedCountyGid,
  onCountryChange,
  onStateChange,
  onCountyChange,
  disabled = false,
}: SpeciesLocationFiltersProps) {
  const { breakpoint } = useResponsive();
  const isStacked = breakpoint === 'phone' || breakpoint === 'tablet';
  const toNullableGid = React.useCallback(
    (value: string) => (value ? String(value) : null),
    [],
  );

  const selectItems = React.useMemo(
    () => [
      {
        key: 'country',
        label: 'Country',
        placeholder: countryLoading ? 'Loading…' : 'Select',
        options: [{ label: 'All countries', value: '' }, ...countryOptions],
        value: selectedCountryGid ?? '',
        disabled: disabled || countryLoading || countryOptions.length === 0,
        onChange: (value: string) => onCountryChange(toNullableGid(value)),
      },
      {
        key: 'state',
        label: 'State',
        placeholder: stateLoading ? 'Loading…' : 'Select',
        options: [{ label: 'All states', value: '' }, ...stateOptions],
        value: selectedStateGid ?? '',
        disabled:
          disabled ||
          !selectedCountryGid ||
          stateLoading ||
          stateOptions.length === 0,
        onChange: (value: string) => onStateChange(toNullableGid(value)),
      },
      {
        key: 'county',
        label: 'County',
        placeholder: countyLoading ? 'Loading…' : 'Select',
        options: [{ label: 'All counties', value: '' }, ...countyOptions],
        value: selectedCountyGid ?? '',
        disabled:
          disabled ||
          !selectedStateGid ||
          countyLoading ||
          countyOptions.length === 0,
        onChange: (value: string) => onCountyChange(toNullableGid(value)),
      },
    ],
    [
      disabled,
      countryLoading,
      countryOptions,
      countyLoading,
      countyOptions,
      onCountryChange,
      onCountyChange,
      onStateChange,
      selectedCountryGid,
      selectedCountyGid,
      selectedStateGid,
      stateLoading,
      stateOptions,
      toNullableGid,
    ],
  );

  return (
    <View style={styles.filterContainer}>
      <ThemedText variant='subheading'>
        Filter Observations by Location
      </ThemedText>

      <View
        testID='filter-row'
        style={[styles.filterRow, isStacked && styles.filterRowStacked]}
      >
        {selectItems.map((item) => (
          <View
            key={item.key}
            style={[styles.filterItem, isStacked && styles.filterItemStacked]}
          >
            <SelectField
              label={item.label}
              placeholder={item.placeholder}
              options={item.options}
              value={item.value}
              onValueChange={item.onChange}
              disabled={item.disabled}
            />
          </View>
        ))}
      </View>
      <GadmAttribution />
    </View>
  );
}

export default SpeciesLocationFilters;

const styles = StyleSheet.create({
  filterContainer: {
    gap: Size.space.text.paragraph,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  filterItem: {
    flexGrow: 1,
    maxWidth: 720,
  },
  filterRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterItemStacked: {
    width: '100%',
    maxWidth: '100%',
  },
});
