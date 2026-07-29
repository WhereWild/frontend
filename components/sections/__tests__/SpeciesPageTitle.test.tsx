// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SpeciesPageTitle } from '../SpeciesPageTitle';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('SpeciesPageTitle', () => {
  const commonName = 'Mountain Ball Cactus';
  const scientificName = 'Pediocactus simpsonii';

  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders the species name and scientific name', () => {
    render(
      <SpeciesPageTitle
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
      <SpeciesPageTitle
        commonName={commonName}
        scientificName={scientificName}
        onPressDownload={handleDownload}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Download ${commonName}`));
    expect(handleDownload).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state and disables the button while downloading', () => {
    const handleDownload = jest.fn();

    render(
      <SpeciesPageTitle
        commonName={commonName}
        scientificName={scientificName}
        onPressDownload={handleDownload}
        isDownloading
      />,
    );

    expect(screen.getByText('Download')).toBeTruthy();
    expect(screen.getByTestId('species-page-title-download-spinner')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Download ${commonName}`));
    expect(handleDownload).not.toHaveBeenCalled();
  });

  it('shows the default download label', () => {
    render(
      <SpeciesPageTitle
        commonName={commonName}
        scientificName={scientificName}
      />,
    );

    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('allows overriding the download label while keeping accessibility text in sync', () => {
    const customLabel = 'Save Report';

    render(
      <SpeciesPageTitle
        commonName={commonName}
        scientificName={scientificName}
        downloadLabel={customLabel}
      />,
    );

    expect(screen.getByText(customLabel)).toBeTruthy();
    expect(screen.getByLabelText(`${customLabel} ${commonName}`)).toBeTruthy();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(
      <SpeciesPageTitle
        commonName={commonName}
        scientificName={scientificName}
      />,
    ).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(
      Colors.light.background.default.default,
    );

    const divider = screen.getByTestId('species-page-title-divider');
    const dividerStyles = StyleSheet.flatten(divider.props.style);
    expect(dividerStyles.backgroundColor).toBe(
      Colors.light.border.brand.secondary,
    );
  });
});
