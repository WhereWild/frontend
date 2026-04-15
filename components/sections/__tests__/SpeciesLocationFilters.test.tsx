import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SpeciesLocationFilters } from '../SpeciesLocationFilters';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;

const defaultProps = {
  countryOptions: [{ label: 'United States', value: 'usa-gid' }],
  stateOptions: [],
  countyOptions: [],
  countryLoading: false,
  stateLoading: false,
  countyLoading: false,
  selectedCountryGid: null,
  selectedStateGid: null,
  selectedCountyGid: null,
  onCountryChange: jest.fn(),
  onStateChange: jest.fn(),
  onCountyChange: jest.fn(),
};

describe('SpeciesLocationFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<
      typeof useResponsive
    >);
  });

  describe('stacking layout', () => {
    it('stacks filters vertically on phone breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<
        typeof useResponsive
      >);
      render(<SpeciesLocationFilters {...defaultProps} />);

      const row = screen.getByTestId('filter-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('column');
    });

    it('stacks filters vertically on tablet breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<
        typeof useResponsive
      >);
      render(<SpeciesLocationFilters {...defaultProps} />);

      const row = screen.getByTestId('filter-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('column');
    });

    it('keeps filters in a row on desktop breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<
        typeof useResponsive
      >);
      render(<SpeciesLocationFilters {...defaultProps} />);

      const row = screen.getByTestId('filter-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('row');
    });
  });
});
