import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Filters, type FiltersProps } from '../Filters';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const countryOptions = [
  { label: 'United States', value: 'us' },
  { label: 'Canada', value: 'ca' },
];

const stateOptions = [
  { label: 'Utah', value: 'ut' },
  { label: 'Colorado', value: 'co' },
];

const countyOptions = [
  { label: 'Salt Lake', value: 'salt-lake' },
  { label: 'Utah County', value: 'utah' },
];

const rankOptions = [
  { label: 'Species', value: 'species' },
  { label: 'Genus', value: 'genus' },
];

const sortVariableOptions = [
  { label: 'Temperature', value: 'temperature' },
  { label: 'Elevation', value: 'elevation' },
];

const sortMetricOptions = [
  { label: 'Average', value: 'average' },
  { label: 'Median', value: 'median' },
];

const baseProps: FiltersProps = {
  countryValue: 'us',
  countryOptions,
  stateValue: 'ut',
  stateOptions,
  countyValue: 'salt-lake',
  countyOptions,
  baseTaxonQuery: '',
  rankValue: 'species',
  rankOptions,
  includeSubspecies: true,
  sortVariableValue: '',
  sortVariableOptions,
  sortMetricValue: 'average',
  sortMetricOptions,
  sortOrder: 'ascending',
  numberOfResults: 10,
  minimumSamples: 1,
};

describe('Filters', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('light');
  });

  describe('color mode', () => {
    it('renders without error in light mode', () => {
      mockUseColorScheme.mockReturnValue('light');
      expect(() => render(<Filters {...baseProps} />)).not.toThrow();
    });

    it('renders without error in dark mode', () => {
      mockUseColorScheme.mockReturnValue('dark');
      expect(() => render(<Filters {...baseProps} />)).not.toThrow();
    });
  });

  describe('rendering', () => {
    it('renders the Filters heading', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Filters')).toBeTruthy();
    });

    it('renders all section headings', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Location')).toBeTruthy();
      expect(screen.getByText('Taxon')).toBeTruthy();
      expect(screen.getByText('Sort')).toBeTruthy();
      expect(screen.getByText('Quantity')).toBeTruthy();
    });

    it('renders location field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Country')).toBeTruthy();
      expect(screen.getByText('State')).toBeTruthy();
      expect(screen.getByText('County')).toBeTruthy();
    });

    it('renders taxon field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Base taxon')).toBeTruthy();
      expect(screen.getByText('Rank')).toBeTruthy();
      expect(screen.getByText('Include subspecies')).toBeTruthy();
    });

    it('renders sort field labels and sort order options', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Ranking-based filters apply after setting Base taxon and Sort variable.')).toBeTruthy();
      expect(screen.getByText('Variable')).toBeTruthy();
      expect(screen.getByText('Sorting metric')).toBeTruthy();
      expect(screen.getByText('Sort order')).toBeTruthy();
      expect(screen.getByText('Ascending')).toBeTruthy();
      expect(screen.getByText('Descending')).toBeTruthy();
    });

    it('renders quantity field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Number of results')).toBeTruthy();
      expect(screen.getByText('Minimum samples')).toBeTruthy();
    });

    it('renders the reset filters button', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByLabelText('Reset filters')).toBeTruthy();
    });
  });

  describe('sort order', () => {
    it('marks Ascending as selected and Descending as unselected when sortOrder is "ascending"', () => {
      render(<Filters {...baseProps} sortOrder="ascending" />);
      expect(screen.getByLabelText('Ascending').props.accessibilityState.selected).toBe(true);
      expect(screen.getByLabelText('Descending').props.accessibilityState.selected).toBe(false);
    });

    it('marks Descending as selected and Ascending as unselected when sortOrder is "descending"', () => {
      render(<Filters {...baseProps} sortOrder="descending" />);
      expect(screen.getByLabelText('Descending').props.accessibilityState.selected).toBe(true);
      expect(screen.getByLabelText('Ascending').props.accessibilityState.selected).toBe(false);
    });

    it('calls onSortOrderChange with "ascending" when the Ascending radio is pressed', () => {
      const handleSortOrderChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          sortOrder="descending"
          onSortOrderChange={handleSortOrderChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Ascending'));
      expect(handleSortOrderChange).toHaveBeenCalledWith('ascending');
    });

    it('calls onSortOrderChange with "descending" when the Descending radio is pressed', () => {
      const handleSortOrderChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          sortOrder="ascending"
          onSortOrderChange={handleSortOrderChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Descending'));
      expect(handleSortOrderChange).toHaveBeenCalledWith('descending');
    });

    it('does not throw when onSortOrderChange is not provided', () => {
      render(<Filters {...baseProps} sortOrder="ascending" />);
      expect(() => {
        fireEvent.press(screen.getByLabelText('Ascending'));
      }).not.toThrow();
    });
  });

  describe('include subspecies', () => {
    it('calls onIncludeSubspeciesChange with false when the switch is toggled off', () => {
      const handleChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          includeSubspecies={true}
          onIncludeSubspeciesChange={handleChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Include subspecies'));
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it('calls onIncludeSubspeciesChange with true when the switch is toggled on', () => {
      const handleChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          includeSubspecies={false}
          onIncludeSubspeciesChange={handleChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Include subspecies'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('does not throw when onIncludeSubspeciesChange is not provided', () => {
      render(<Filters {...baseProps} includeSubspecies={false} />);
      expect(() => {
        fireEvent.press(screen.getByLabelText('Include subspecies'));
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('calls onResetFilters when the reset button is pressed', () => {
      const handleReset = jest.fn();
      render(<Filters {...baseProps} onResetFilters={handleReset} />);
      fireEvent.press(screen.getByLabelText('Reset filters'));
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onResetFilters is not provided', () => {
      render(<Filters {...baseProps} />);
      expect(() => {
        fireEvent.press(screen.getByLabelText('Reset filters'));
      }).not.toThrow();
    });
  });
});
