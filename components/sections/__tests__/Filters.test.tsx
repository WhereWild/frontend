import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Filters, type FiltersProps } from '../Filters';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesSummary } from '@/data/types';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

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
  rankValue: '',
  rankOptions,
  includeSubspecies: true,
  sortVariableValue: '',
  sortVariableOptions,
  sortMetricValue: 'average',
  sortMetricOptions,
  sortOrder: 'ascending',
  numberOfResults: 10,
  minimumSamples: 0,
};

describe('Filters', () => {
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;
  let scheduledFrameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('light');
    scheduledFrameCallbacks = [];
    requestAnimationFrameSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        scheduledFrameCallbacks.push(callback);
        return scheduledFrameCallbacks.length;
      });
    cancelAnimationFrameSpy = jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    jest.restoreAllMocks();
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
      expect(screen.getByText('Ranking')).toBeTruthy();
      expect(screen.getByText('Quantity')).toBeTruthy();
    });

    it('renders location field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Country')).toBeTruthy();
      expect(screen.getByText('State')).toBeTruthy();
      expect(screen.getByText('County')).toBeTruthy();
    });

    it('shows all-options for location fields so users can clear selection', () => {
      const rendered = render(<Filters {...baseProps} />);

      const findPressableByAccessibilityLabel = (label: string) => {
        const matches = rendered.UNSAFE_root.findAll(
          (node) =>
            node.props?.accessibilityLabel === label &&
            typeof node.props?.onPress === 'function',
        );
        if (matches.length === 0) {
          throw new Error(`Expected node with accessibilityLabel ${label}.`);
        }

        return matches[0];
      };

      fireEvent.press(findPressableByAccessibilityLabel('Country'));
      expect(
        findPressableByAccessibilityLabel('Select All countries'),
      ).toBeTruthy();
      fireEvent.press(
        findPressableByAccessibilityLabel('Select All countries'),
      );

      fireEvent.press(findPressableByAccessibilityLabel('State'));
      expect(
        findPressableByAccessibilityLabel('Select All states'),
      ).toBeTruthy();
      fireEvent.press(findPressableByAccessibilityLabel('Select All states'));

      fireEvent.press(findPressableByAccessibilityLabel('County'));
      expect(
        findPressableByAccessibilityLabel('Select All counties'),
      ).toBeTruthy();
    });

    it('renders taxon field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Scope taxon')).toBeTruthy();
    });

    it('renders ranking field labels and sort order options', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Rank')).toBeTruthy();
      expect(screen.getByText('Include subspecies')).toBeTruthy();
      expect(
        screen.getByText(
          'Add a Scope taxon to limit search results to descendant taxa. Then choose Rank, Variable, and Metric to rank within that scope.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Variable')).toBeTruthy();
      expect(screen.getByText('Sorting metric')).toBeTruthy();
      expect(screen.getByText('Sort order')).toBeTruthy();
      expect(screen.getByText('Ascending')).toBeTruthy();
      expect(screen.getByText('Descending')).toBeTruthy();
      expect(screen.getByText('Minimum samples')).toBeTruthy();
    });

    it('renders quantity field labels', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByText('Number of results')).toBeTruthy();
    });

    it('renders the reset filters button', () => {
      render(<Filters {...baseProps} />);
      expect(screen.getByLabelText('Reset filters')).toBeTruthy();
    });
  });

  describe('sort order', () => {
    it('marks Ascending as selected and Descending as unselected when sortOrder is "ascending"', () => {
      render(<Filters {...baseProps} sortOrder='ascending' />);
      expect(
        screen.getByLabelText('Ascending').props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByLabelText('Descending').props.accessibilityState.selected,
      ).toBe(false);
    });

    it('marks Descending as selected and Ascending as unselected when sortOrder is "descending"', () => {
      render(<Filters {...baseProps} sortOrder='descending' />);
      expect(
        screen.getByLabelText('Descending').props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByLabelText('Ascending').props.accessibilityState.selected,
      ).toBe(false);
    });

    it('calls onSortOrderChange with "ascending" when the Ascending radio is pressed', () => {
      const handleSortOrderChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          sortOrder='descending'
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
          sortOrder='ascending'
          onSortOrderChange={handleSortOrderChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Descending'));
      expect(handleSortOrderChange).toHaveBeenCalledWith('descending');
    });
  });

  describe('include subspecies', () => {
    it('calls onIncludeSubspeciesChange with false when the switch is toggled off', () => {
      const handleChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          rankValue='species'
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
          rankValue='species'
          includeSubspecies={false}
          onIncludeSubspeciesChange={handleChange}
        />,
      );
      fireEvent.press(screen.getByLabelText('Include subspecies'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('disables include subspecies when rank is not species', () => {
      const handleChange = jest.fn();
      render(
        <Filters
          {...baseProps}
          rankValue='genus'
          includeSubspecies={true}
          onIncludeSubspeciesChange={handleChange}
        />,
      );

      expect(
        screen.getByLabelText('Include subspecies').props.accessibilityState
          ?.disabled,
      ).toBe(true);
      expect(
        screen.getByText('Available only when Rank is set to Species'),
      ).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Include subspecies'));
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('variable selection', () => {
    it('disables Variable until a rank is selected', () => {
      render(
        <Filters {...baseProps} rankValue='' sortVariableDisabled={true} />,
      );

      expect(
        screen.getByLabelText('Variable').props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it('enables Variable once a rank is selected', () => {
      render(
        <Filters
          {...baseProps}
          rankValue='species'
          sortVariableDisabled={false}
        />,
      );

      expect(
        screen.getByLabelText('Variable').props.accessibilityState?.disabled,
      ).toBe(false);
    });
  });

  describe('reset', () => {
    it('calls onResetFilters when the reset button is pressed', () => {
      const handleReset = jest.fn();
      render(<Filters {...baseProps} onResetFilters={handleReset} />);
      fireEvent.press(screen.getByLabelText('Reset filters'));
      expect(handleReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('base taxon suggestions', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
    });

    const suggestion: SpeciesSummary = {
      taxonId: 1,
      commonName: 'Gray wolf',
      commonNames: ['Gray wolf'],
      scientificName: 'Canis lupus',
      description: 'Tap to view species details',
    };

    it('renders visible suggestions when suggestions are open', () => {
      render(
        <Filters
          {...baseProps}
          baseTaxonQuery='canis'
          baseTaxonSuggestionsVisible
          baseTaxonSuggestions={[suggestion]}
        />,
      );

      expect(screen.getByText('Gray wolf')).toBeTruthy();
    });
  });
});
