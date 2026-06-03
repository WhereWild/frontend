// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import React from 'react';
import { SourceAttribution } from '../SourceAttribution';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('SourceAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
  });

  it('returns null when no source ids resolve', () => {
    const { queryByText } = render(
      <SourceAttribution sourceIds={['missing']} dataSources={{}} />,
    );

    expect(queryByText('Source:')).toBeNull();
  });

  it('renders DOI and data page links when both are available', () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);

    render(
      <SourceAttribution
        sourceIds={['open_meteo']}
        dataSources={{
          open_meteo: {
            name: 'Open-Meteo',
            url: 'https://open-meteo.example/data',
            license: 'CC BY 4.0',
            references: [
              {
                authors: 'Open-Meteo Team',
                title: 'Open-Meteo Dataset',
                year: 2024,
                doi: 'https://doi.org/open-meteo',
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('Source: Open-Meteo ')).toBeTruthy();
    expect(screen.getByText('DOI')).toBeTruthy();
    expect(screen.getByText('Data page')).toBeTruthy();

    fireEvent.press(screen.getByText('DOI'));
    fireEvent.press(screen.getByText('Data page'));

    expect(openUrlSpy).toHaveBeenNthCalledWith(1, 'https://doi.org/open-meteo');
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      2,
      'https://open-meteo.example/data',
    );
  });

  it('omits the DOI link when only a data page is available', () => {
    render(
      <SourceAttribution
        sourceIds={['gadm']}
        dataSources={{
          gadm: {
            name: 'GADM',
            url: 'https://gadm.example/data',
            license: 'CC BY-NC 4.0',
            references: [],
          },
        }}
      />,
    );

    expect(screen.getByText('Source: GADM ')).toBeTruthy();
    expect(screen.getByText('Data page')).toBeTruthy();
    expect(screen.queryByText('DOI')).toBeNull();
  });

  it('omits the data-page link when only a DOI is available', () => {
    render(
      <SourceAttribution
        sourceIds={['paper_only']}
        dataSources={{
          paper_only: {
            name: 'Paper Only',
            url: '',
            license: 'CC BY 4.0',
            references: [
              {
                authors: 'Example Authors',
                title: 'Example Paper',
                year: 2023,
                doi: 'https://doi.org/paper-only',
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('DOI')).toBeTruthy();
    expect(screen.queryByText('Data page')).toBeNull();
  });

  it('renders a source label without trailing link spacing when no DOI or data page exists', () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(
      <SourceAttribution
        sourceIds={['no_links']}
        dataSources={{
          no_links: {
            name: 'No Links Source',
            url: null as never,
            license: 'CC BY 4.0',
            references: [],
          },
        }}
      />,
    );

    expect(screen.getByText('Source: No Links Source')).toBeTruthy();
    expect(screen.queryByText('DOI')).toBeNull();
    expect(screen.queryByText('Data page')).toBeNull();
  });
});
