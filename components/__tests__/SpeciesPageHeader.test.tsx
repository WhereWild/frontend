import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SpeciesPageHeader } from '../sections/SpeciesPageHeader';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('SpeciesPageHeader', () => {
  const commonName = 'Mountain Ball Cactus';
  const scientificName = 'Pediocactus simpsonii';

  beforeEach(() => { 
    mockUseColorScheme.mockReturnValue('dark');
  });



  it('renders the species name and scientific name', () => {
    render(
      <SpeciesPageHeader
        commonName={commonName}
        scientificName={scientificName}
      />,
    );

    expect(screen.getByText(commonName)).toBeTruthy();
    expect(screen.getByText(scientificName)).toBeTruthy();
  });

  it('invokes download handler when button is pressed', () => {
    const handleDownload = jest.fn();

    render(
      <SpeciesPageHeader
        commonName={commonName}
        scientificName={scientificName}
        onPressDownload={handleDownload}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Download ${commonName}`));
    expect(handleDownload).toHaveBeenCalledTimes(1);
  });

  it('shows the default download label', () => {
    render(
      <SpeciesPageHeader
        commonName={commonName}
        scientificName={scientificName}
      />,
    );

    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('allows overriding the download label while keeping accessibility text in sync', () => {
    const customLabel = 'Save Report';

    render(
      <SpeciesPageHeader
        commonName={commonName}
        scientificName={scientificName}
        downloadLabel={customLabel}
      />,
    );

    expect(screen.getByText(customLabel)).toBeTruthy();
    expect(
      screen.getByLabelText(`${customLabel} ${commonName}`),
    ).toBeTruthy();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(
      <SpeciesPageHeader
        commonName={commonName}
        scientificName={scientificName}
      />,
    ).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);

    const divider = screen.getByTestId('species-page-header-divider');
    const dividerStyles = StyleSheet.flatten(divider.props.style);
    expect(dividerStyles.backgroundColor).toBe(
      Colors.light.border.brand.secondary,
    );
  });
});
