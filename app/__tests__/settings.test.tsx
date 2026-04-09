import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/context/SettingsContext';
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import Settings from '../settings';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;

const mockSetRegion = jest.fn();
const mockSetUnits = jest.fn();
const mockSetLanguage = jest.fn();
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

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ contentWidth: 720, breakpoint: 'desktop' }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => ({
    paddingHorizontal: 12,
  })),
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
    SelectField: (props: Record<string, unknown>) => {
      mockSelectField(props);
      return mockReact.createElement(mockReactNative.View, {
        testID: `select-${String(props.label)}`,
      });
    },
  };
});

describe('Settings screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectField.mockReset();

    mockUseSettings.mockReturnValue({
      region: 'utah',
      setRegion: mockSetRegion,
      units: 'metric',
      setUnits: mockSetUnits,
      language: 'en',
      setLanguage: mockSetLanguage,
    });
  });

  describe('color mode styles', () => {
    it('applies dark mode background color', () => {
      mockUseColorScheme.mockReturnValue('dark');

      const screen = render(<Settings />);
      const settingsScreen = screen.getByTestId('settings-screen');
      const settingsScreenStyle = StyleSheet.flatten(
        settingsScreen.props.style,
      );
      expect(settingsScreenStyle.backgroundColor).toBe(
        Colors.dark.background.default.default,
      );
    });

    it('applies light mode background color', () => {
      mockUseColorScheme.mockReturnValue('light');

      const screen = render(<Settings />);
      const settingsScreen = screen.getByTestId('settings-screen');
      const settingsScreenStyle = StyleSheet.flatten(
        settingsScreen.props.style,
      );
      expect(settingsScreenStyle.backgroundColor).toBe(
        Colors.light.background.default.default,
      );
    });
  });

  describe('settings logic', () => {
    it('renders localization controls', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      expect(screen.getByText('Localization')).toBeTruthy();
      expect(screen.getByTestId('select-Region')).toBeTruthy();
      expect(screen.getByTestId('select-Language')).toBeTruthy();
      expect(screen.getByTestId('select-Units')).toBeTruthy();
    });

    it('wires region and language updates', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

      const onRegionChange = getSelectFieldChangeHandler('Region');
      const onLanguageChange = getSelectFieldChangeHandler('Language');

      act(() => {
        onRegionChange?.('california');
        onLanguageChange?.('fr');
      });

      expect(mockSetRegion).toHaveBeenCalledWith('california');
      expect(mockSetLanguage).toHaveBeenCalledWith('fr');
    });

    it('only accepts valid units values', () => {
      mockUseColorScheme.mockReturnValue('dark');

      render(<Settings />);

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
  });
});
