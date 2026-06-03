// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { SpeciesObservationFilters } from '../SpeciesObservationFilters';

let lastSelectProps: any = null;
jest.mock('@/components/inputs/SelectField', () => ({
  SelectField: (props: any) => {
    lastSelectProps = props;
    return null;
  },
}));

describe('SpeciesObservationFilters', () => {
  beforeEach(() => {
    lastSelectProps = null;
  });

  it('shows loading state when phenologyCounts is null', () => {
    render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={null}
      />,
    );
    expect(lastSelectProps.placeholder).toBe('Loading…');
    expect(lastSelectProps.disabled).toBe(true);
  });

  it('shows only All option when phenologyCounts is null', () => {
    render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={null}
      />,
    );
    expect(lastSelectProps.options).toEqual([{ label: 'All', value: '' }]);
  });

  it('builds sorted options from phenologyCounts', () => {
    render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={{ flowers: 100, 'fruits or seeds': 50 }}
      />,
    );
    expect(lastSelectProps.disabled).toBe(false);
    expect(lastSelectProps.placeholder).toBe('Select');
    expect(lastSelectProps.options[0]).toEqual({ label: 'All', value: '' });
    expect(lastSelectProps.options[1].value).toBe('flowers');
    expect(lastSelectProps.options[2].value).toBe('fruits or seeds');
  });

  it('calls onPhenologyChange with null when empty string selected', () => {
    const onChange = jest.fn();
    render(
      <SpeciesObservationFilters
        selectedPhenology='flowers'
        onPhenologyChange={onChange}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    lastSelectProps.onValueChange('');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onPhenologyChange with value when option selected', () => {
    const onChange = jest.fn();
    render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={onChange}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    lastSelectProps.onValueChange('flowers');
    expect(onChange).toHaveBeenCalledWith('flowers');
  });

  it('reflects selectedPhenology as current value', () => {
    render(
      <SpeciesObservationFilters
        selectedPhenology='flowers'
        onPhenologyChange={jest.fn()}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    expect(lastSelectProps.value).toBe('flowers');
  });
});
