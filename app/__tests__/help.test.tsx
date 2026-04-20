import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform } from 'react-native';
import HelpScreen from '../help';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/help',
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
  fetchDataSources: jest.fn(() => new Promise(() => undefined)),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

  return {
    ContentImage: ({ label }: { label?: string }) =>
      React.createElement(View, { accessibilityLabel: label }),
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

jest.mock('@/assets/images/help_homepage.png', () => 1, { virtual: true });
jest.mock('@/assets/images/help_homepage_plants.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_search_simple.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_env_features.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_categorical_features.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_weather_code.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_location_filter.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_location_filter_applied.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_slicing.png', () => 1, { virtual: true });
jest.mock('@/assets/images/help_slicing_map.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_categorical_highlighted.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_out_of_range.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_out_of_range_categorical.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_ml_model.png', () => 1, { virtual: true });
jest.mock('@/assets/images/help_ml_model_zoomed.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_search_filter.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_search_cacti_temp.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_search_cacti_snow.png', () => 1, {
  virtual: true,
});
jest.mock('@/assets/images/help_custom_data.png', () => 1, { virtual: true });

describe('Help screen', () => {
  const originalPlatform = Platform.OS;
  const mockOpenUrl = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined);

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' });
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

  it('renders the help page title and key sections', () => {
    render(<HelpScreen />);

    expect(screen.queryByText('Help')).toBeNull();
    expect(screen.getByText('How do I use WhereWild?')).toBeTruthy();
    expect(screen.getByText('Homepage')).toBeTruthy();
    expect(screen.getByText('Species page')).toBeTruthy();
    expect(screen.getByText('Search page')).toBeTruthy();
    expect(screen.getByText('That\u2019s a wrap!')).toBeTruthy();
  });

  it('renders the shared page title on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<HelpScreen />);

    expect(screen.getByText('Help')).toBeTruthy();
  });

  it('opens representative help links when pressed', () => {
    render(<HelpScreen />);

    fireEvent.press(screen.getByText('link'));
    fireEvent.press(screen.getByText('mountgambeloak@gmail.com'));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://wherewild.net/species/2750737/calochortus-nuttallii',
    );
    expect(mockOpenUrl).toHaveBeenNthCalledWith(
      2,
      'mailto:mountgambeloak@gmail.com',
    );
  });
});
