// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform } from 'react-native';
import { SourceEntry } from '@/components/sections/SourceEntry';
import AcknowledgementsScreen from '../acknowledgements';

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: () => ({
    gbif_occurrence: {
      name: 'GBIF Occurrence Download',
      url: 'https://www.gbif.org/occurrence/download',
      license: 'CC BY 4.0',
      references: [
        {
          authors: 'GBIF.org',
          title: 'GBIF.org (2026) GBIF Occurrence Download',
          doi: 'https://doi.org/10.15468/dl.test',
        },
      ],
    },
    inat_observations: {
      name: 'iNaturalist Research-grade Observations',
      url: 'https://www.inaturalist.org/',
      license: 'Varies by record (CC BY, CC BY-NC, or CC0)',
      references: [
        {
          authors: 'iNaturalist contributors, iNaturalist',
          year: 2026,
          title:
            'iNaturalist Research-grade Observations. iNaturalist.org. Occurrence dataset https://doi.org/10.15468/ab3s5x accessed via GBIF.org on 2026-06-05.',
        },
      ],
    },
    open_meteo: {
      name: 'Open-Meteo',
      url: 'https://open-meteo.com/',
      license: 'CC BY 4.0',
      references: [
        {
          authors: 'Zippenfenig, P.',
          year: 2023,
          title: 'Open-Meteo.com Weather API',
          journal: 'Zenodo',
          doi: 'https://doi.org/10.5281/ZENODO.7970649',
        },
      ],
    },
    copernicus_era5: {
      name: 'ERA5',
      url: 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels',
      license: 'CC BY 4.0',
      references: [
        {
          authors: 'Hersbach, H., Bell, B., Berrisford, P., et al.',
          year: 2023,
          title: 'ERA5 hourly data on single levels from 1940 to present',
          journal: 'ECMWF',
          doi: 'https://doi.org/10.24381/cds.adbb2d47',
        },
      ],
    },
    gadm: {
      name: 'GADM (Global Administrative Areas)',
      url: 'https://gadm.org/',
      license: 'Free for academic, research, and teaching use.',
      references: [
        {
          authors:
            'Hijmans, R.J., Garcia, N., Kapoor, J., Rala, A., Maunahan, A., and Wieczorek, J.',
          year: 2012,
          title:
            'Global Administrative Areas (GADM database of Global Administrative Areas)',
          url: 'https://gadm.org/data.html',
        },
      ],
    },
  }),
}));

const mockUseResponsive = jest.fn(() => ({ textWidth: 720 }));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const { Markdown } = jest.requireActual('@/components/markdown/Markdown');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    PageTitle: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    ThemedText: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      variant?: string;
      style?: object;
      onPress?: () => void;
    }) => React.createElement(Text, { onPress }, children),
    Markdown,
  };
});

describe('Acknowledgements screen', () => {
  const originalPlatform = Platform.OS;
  const mockOpenUrl = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined);

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ textWidth: 720 });
    mockOpenUrl.mockClear();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  afterAll(() => {
    mockOpenUrl.mockRestore();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('renders the introduction copy', () => {
    render(<AcknowledgementsScreen />);

    expect(
      screen.getByText(
        /WhereWild is built on top of a number of remarkable open datasets\./,
      ),
    ).toBeTruthy();
  });

  it('renders representative data sources and citations', () => {
    render(<AcknowledgementsScreen />);

    expect(screen.getByText('GBIF Occurrence Download')).toBeTruthy();
    expect(
      screen.getByText('iNaturalist Research-grade Observations'),
    ).toBeTruthy();
    expect(screen.getByText('Open-Meteo')).toBeTruthy();
    expect(screen.getByText('ERA5')).toBeTruthy();
    expect(screen.getByText('GADM (Global Administrative Areas)')).toBeTruthy();
    expect(screen.getByText(/Open-Meteo\.com Weather API/)).toBeTruthy();
  });

  it('shows the page title on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<AcknowledgementsScreen />);

    // Two matches expected on web: the page title and the footer's nav link.
    expect(screen.getAllByText('Acknowledgements').length).toBeGreaterThan(0);
  });

  it('hides the page title in the body on native', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    render(<AcknowledgementsScreen />);

    const matches = screen.queryAllByText('Acknowledgements');
    expect(matches).toHaveLength(0);
  });

  it('renders source entries without optional links or notes', () => {
    render(
      <SourceEntry
        source={{
          name: 'Test Source',
          url: 'https://example.com/source',
          license: 'Custom License',
          references: [
            {
              authors: 'Doe, J.',
              year: 2024,
              title: 'Test Citation',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Test Source')).toBeTruthy();
    expect(screen.getByText(/License:\s*Custom License/)).toBeTruthy();
    expect(
      screen.getByText(/Doe, J\. \(2024\)\. Test Citation\./),
    ).toBeTruthy();
  });

  it('assigns a slugified nativeID to each source on web, so /acknowledgements#fabdem-v1-2 can be linked to directly', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { UNSAFE_getByProps } = render(
      <SourceEntry
        source={{
          name: 'FABDEM V1.2',
          url: 'https://example.com/fabdem',
          license: 'CC BY-NC-SA 4.0',
          references: [],
        }}
      />,
    );

    expect(UNSAFE_getByProps({ nativeID: 'fabdem-v1-2' })).toBeTruthy();
  });

  it('opens source, license, and citation links when pressed', () => {
    render(
      <>
        <SourceEntry
          source={{
            name: 'Linked Source',
            url: 'https://example.com/source',
            license: 'Linked License',
            license_url: 'https://example.com/license',
            references: [
              {
                authors: 'Doe, J.',
                year: 2024,
                title: 'Citation With DOI',
                doi: 'https://doi.org/10.1000/example',
              },
            ],
          }}
        />
        <SourceEntry
          source={{
            name: 'URL Source',
            url: 'https://example.com/other-source',
            license: 'Plain License',
            references: [
              {
                authors: 'Smith, A.',
                year: 2023,
                title: 'Citation With URL',
                url: 'https://example.com/citation',
              },
            ],
          }}
        />
      </>,
    );

    fireEvent.press(screen.getByText('Linked Source'));
    fireEvent.press(screen.getByText('Linked License'));
    fireEvent.press(screen.getByText('https://doi.org/10.1000/example'));
    fireEvent.press(screen.getByText('https://example.com/citation'));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://example.com/source',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      2,
      'https://example.com/license',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      3,
      'https://doi.org/10.1000/example',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      4,
      'https://example.com/citation',
    );
  });
});
