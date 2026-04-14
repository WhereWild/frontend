import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform } from 'react-native';
import AcknowledgementsScreen, { SourceEntry } from '../acknowledgements';

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

const mockUseResponsive = jest.fn(() => ({ textWidth: 720 }));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

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

    expect(screen.getByText('GBIF / iNaturalist')).toBeTruthy();
    expect(screen.getByText('Open-Meteo (ERA5 / ERA5-Land)')).toBeTruthy();
    expect(screen.getByText('GADM (Global Administrative Areas)')).toBeTruthy();
    expect(screen.getAllByText(/Open-Meteo\.com Weather API/).length).toBe(2);
    expect(
      screen.getByText(
        /University of California, Berkeley, Museum of Vertebrate Zoology/,
      ),
    ).toBeTruthy();
  });

  it('shows the page title on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<AcknowledgementsScreen />);

    expect(screen.getByText('Acknowledgements')).toBeTruthy();
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
      screen.getByText(/Doe, J\. \(2024\)\. “Test Citation\.”\./),
    ).toBeTruthy();
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
