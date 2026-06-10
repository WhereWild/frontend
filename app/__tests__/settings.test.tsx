// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/context/SettingsContext';
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import Settings from '../settings';

const mockPush = jest.fn();

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;

const mockSetUnits = jest.fn();
const mockSetColorModeOverride = jest.fn();
const mockSelectField = jest.fn();

function getSelectFieldChangeHandler(
  label: string,
): ((value: string) => void) | undefined {
  const matchedCall = mockSelectField.mock.calls.find(
    ([props]) => props?.label === label,
  );
  if (!matchedCall) {
    return undefined;
  }
  return matchedCall[0].onValueChange as ((value: string) => void) | undefined;
}

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ contentWidth: 720, breakpoint: 'desktop' }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => ({
    paddingHorizontal: 12,
  })),
}));

jest.mock('@/context/SettingsContext', () => ({
  useSettings: jest.fn(),
  isUnitSystem: (value: string) => value === 'metric' || value === 'imperial',
  isColorModeOverride: (value: string) =>
    value === 'system' || value === 'light' || value === 'dark',
}));

jest.mock('@/components', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const mockReactNative = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    WebPageHeader: () =>
      mockReact.createElement(mockReactNative.View, { testID: 'page-header' }),
    PageTitle: ({ title }: { title: string }) =>
      mockReact.createElement(
        mockReactNative.Text,
        { testID: 'page-title' },
        title,
      ),
    ThemedText: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(mockReactNative.Text, null, children),
    PageScrollContainer: ({
      children,
      style,
      testID,
      contentContainerStyle,
    }: any) =>
      mockReact.createElement(
        mockReactNative.View,
        { style, testID },
        mockReact.createElement(
          mockReactNative.View,
          { style: contentContainerStyle },
          children,
        ),
      ),
    SelectField: (props: Record<string, unknown>) => {
      mockSelectField(props);
      return mockReact.createElement(mockReactNative.View, {
        testID: `select-${String(props.label)}`,
      });
    },
    Button: ({ label, onPress }: { label: string; onPress?: () => void }) =>
      mockReact.createElement(
        mockReactNative.Text,
        {
          onPress,
          testID: `button-${label}`,
        },
        label,
      ),
  };
});

describe('Settings screen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectField.mockReset();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });

    mockUseSettings.mockReturnValue({
      region: 'utah',
      setRegion: jest.fn(),
      units: 'metric',
      setUnits: mockSetUnits,
      language: 'en',
      setLanguage: jest.fn(),
      colorModeOverride: 'system',
      setColorModeOverride: mockSetColorModeOverride,
      colormap: 'viridis',
      setColormap: jest.fn(),
      circularColormap: 'twilight_90',
      setCircularColormap: jest.fn(),
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  describe('settings logic', () => {
    it('renders localization controls', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      expect(screen.queryByTestId('page-title')).toBeNull();
      expect(screen.getByText('Localization')).toBeTruthy();
      expect(screen.getByTestId('select-Color mode')).toBeTruthy();
      expect(screen.getByTestId('select-Location')).toBeTruthy();
      expect(screen.getByTestId('select-Language')).toBeTruthy();
      expect(screen.getByTestId('select-Units')).toBeTruthy();
    });

    it('renders color mode override with device default selected', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      const colorModeCall = mockSelectField.mock.calls.find(
        ([props]) => props?.label === 'Color mode',
      );

      expect(colorModeCall?.[0]).toMatchObject({
        allowSearch: false,
        value: 'system',
        options: [
          { label: 'Device default', value: 'system' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ],
      });
    });

    it('renders disabled location and language fields with fixed values', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      const locationCall = mockSelectField.mock.calls.find(
        ([props]) => props?.label === 'Location',
      );
      const languageCall = mockSelectField.mock.calls.find(
        ([props]) => props?.label === 'Language',
      );

      expect(locationCall?.[0]).toMatchObject({
        disabled: true,
        value: 'utah',
        options: [{ label: 'Utah', value: 'utah' }],
      });
      expect(languageCall?.[0]).toMatchObject({
        disabled: true,
        value: 'en',
        options: [{ label: 'English', value: 'en' }],
      });
    });

    it('only accepts valid units values', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      const unitsCall = mockSelectField.mock.calls.find(
        ([props]) => props?.label === 'Units',
      );

      expect(unitsCall?.[0]).toMatchObject({
        allowSearch: false,
        value: 'metric',
        options: [
          { label: 'Metric (°C, km)', value: 'metric' },
          { label: 'Imperial (°F, mi)', value: 'imperial' },
        ],
      });

      const onUnitsChange = getSelectFieldChangeHandler('Units');

      act(() => {
        onUnitsChange?.('metric');
        onUnitsChange?.('imperial');
        onUnitsChange?.('kelvin');
      });

      expect(mockSetUnits).toHaveBeenCalledTimes(2);
      expect(mockSetUnits).toHaveBeenNthCalledWith(1, 'metric');
      expect(mockSetUnits).toHaveBeenNthCalledWith(2, 'imperial');
      expect(mockSetUnits).not.toHaveBeenCalledWith('kelvin');
    });

    it('only accepts valid color mode override values', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      const onColorModeChange = getSelectFieldChangeHandler('Color mode');

      act(() => {
        onColorModeChange?.('system');
        onColorModeChange?.('light');
        onColorModeChange?.('dark');
        onColorModeChange?.('sepia');
      });

      expect(mockSetColorModeOverride).toHaveBeenCalledTimes(3);
      expect(mockSetColorModeOverride).toHaveBeenNthCalledWith(1, 'system');
      expect(mockSetColorModeOverride).toHaveBeenNthCalledWith(2, 'light');
      expect(mockSetColorModeOverride).toHaveBeenNthCalledWith(3, 'dark');
      expect(mockSetColorModeOverride).not.toHaveBeenCalledWith('sepia');
    });

    it('shows a native-only about button that opens the about page', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      act(() => {
        screen.getByTestId('button-About WhereWild').props.onPress();
      });

      expect(mockPush).toHaveBeenCalledWith('/about');
    });

    it('shows a native-only upload button that opens the upload page', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      act(() => {
        screen.getByTestId('button-Upload Custom Data').props.onPress();
      });

      expect(mockPush).toHaveBeenCalledWith('/upload');
    });

    it('omits the about button on web', () => {
      mockUseColorScheme.mockReturnValue('dark');
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: 'web',
      });

      render(<Settings />);

      expect(screen.queryByTestId('button-About WhereWild')).toBeNull();
      expect(screen.queryByTestId('button-Upload Custom Data')).toBeNull();
    });
  });
});
