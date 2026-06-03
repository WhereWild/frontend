// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform } from 'react-native';
import AboutScreen from '../about';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/about',
}));

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

const mockUseResponsive = jest.fn(() => ({ breakpoint: 'desktop' }));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchDataSources: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

  return {
    ContentImage: ({ label }: { label?: string }) =>
      React.createElement(View, { accessibilityLabel: label }),
    IconButton: ({
      accessibilityLabel,
      onPress,
    }: {
      accessibilityLabel?: string;
      onPress?: () => void;
    }) =>
      React.createElement(
        Text,
        {
          accessibilityLabel,
          onPress,
          testID: `icon-button-${accessibilityLabel}`,
        },
        accessibilityLabel,
      ),
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
      onPress?: () => void;
    }) => React.createElement(Text, { onPress }, children),
  };
});

jest.mock('@/assets/icons', () => ({
  IconGithub: () => null,
  IconLinkedin: () => null,
  IconMail: () => null,
}));

jest.mock('@/assets/images/about_opuntia_distribution.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/about_landcover.png', () => 1, { virtual: true });
jest.mock('@/assets/images/about_mojavensis_density.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/about_lucas.png', () => 1, { virtual: true });
jest.mock('@/assets/images/about_luke.png', () => 1, { virtual: true });
jest.mock('@/assets/images/about_draeden.png', () => 1, { virtual: true });
jest.mock('@/assets/images/about_kelly.png', () => 1, { virtual: true });

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('About screen', () => {
  const originalPlatform = Platform.OS;
  const mockOpenUrl = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined);

  beforeEach(() => {
    mockPush.mockClear();
    mockOpenUrl.mockClear();
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' });
    mockUseColorScheme.mockReturnValue('dark');
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

  it('renders the page title and acknowledgements link section', () => {
    render(<AboutScreen />);

    expect(screen.getByText('Acknowledgements')).toBeTruthy();
    expect(screen.getByText('acknowledgements page')).toBeTruthy();
  });

  it('navigates to the acknowledgements page when the link is pressed', () => {
    render(<AboutScreen />);

    fireEvent.press(screen.getByText('acknowledgements page'));

    expect(mockPush).toHaveBeenCalledWith('/acknowledgements');
  });

  it('renders the welcome heading and intro text', () => {
    render(<AboutScreen />);

    expect(screen.getByText('Welcome to WhereWild!')).toBeTruthy();
  });

  it('renders the what does WhereWild do section', () => {
    render(<AboutScreen />);

    expect(
      screen.getByText('What does WhereWild do and how does it work?'),
    ).toBeTruthy();
  });

  it('renders the team members section with all four names', () => {
    render(<AboutScreen />);

    expect(screen.getByText('Team Members')).toBeTruthy();
    expect(screen.getByText('Lucas Pearce')).toBeTruthy();
    expect(screen.getByText('Kelly Wu')).toBeTruthy();
    expect(screen.getByText('Luke Allen')).toBeTruthy();
    expect(screen.getByText('Draeden Jensen')).toBeTruthy();
  });

  it('renders GitHub and LinkedIn icon buttons for Lucas', () => {
    render(<AboutScreen />);

    expect(
      screen.getByTestId('icon-button-Lucas Pearce on GitHub'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('icon-button-Lucas Pearce on LinkedIn'),
    ).toBeTruthy();
  });

  it('opens representative inline content links when pressed', () => {
    render(<AboutScreen />);

    fireEvent.press(screen.getByText('a cactus'));
    fireEvent.press(screen.getByText('Research Grade'));
    fireEvent.press(screen.getByText('historical weather data'));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://www.inaturalist.org/observations/345543375',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      2,
      'https://help.inaturalist.org/en/support/solutions/articles/151000169936-what-is-the-data-quality-assessment-and-how-do-observations-qualify-to-become-research-grade-',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      3,
      'https://open-meteo.com/en/docs/historical-weather-api',
    );
  });

  it('opens representative caption and social links when pressed', () => {
    render(<AboutScreen />);

    fireEvent.press(screen.getByText('DOI'));
    fireEvent.press(screen.getByText('Data page'));
    fireEvent.press(screen.getByTestId('icon-button-Lucas Pearce on GitHub'));
    fireEvent.press(screen.getByTestId('icon-button-Email Luke Allen'));
    fireEvent.press(
      screen.getByTestId('icon-button-Draeden Jensen on LinkedIn'),
    );

    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://doi.org/10.5281/zenodo.4280923',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      2,
      'https://zenodo.org/records/4280923',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      3,
      'https://github.com/MtGambelOak',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      4,
      'mailto:lukeallen159111@gmail.com',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      5,
      'https://www.linkedin.com/in/denmark-jensen-228b7626b',
    );
  });

  it('opens Kelly social links when pressed', () => {
    render(<AboutScreen />);

    fireEvent.press(screen.getByTestId('icon-button-Kelly Wu on GitHub'));
    fireEvent.press(screen.getByTestId('icon-button-Kelly Wu on LinkedIn'));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://github.com/kellynyanbinary',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      2,
      'https://www.linkedin.com/in/kellyhanwu/',
    );
  });

  it('renders on compact breakpoints and in light mode', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' });
    mockUseColorScheme.mockReturnValue('light');

    render(<AboutScreen />);

    expect(screen.getByText('Welcome to WhereWild!')).toBeTruthy();
    expect(screen.getByText('Kelly Wu')).toBeTruthy();
  });

  it('renders the web head branch', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<AboutScreen />);

    expect(screen.getByText('About')).toBeTruthy();
  });
});
