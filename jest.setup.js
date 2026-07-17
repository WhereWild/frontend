// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup for Expo testing environment
/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

// Mock Expo Winter runtime (Expo 54+)
global.__ExpoImportMetaRegistry = new Map();
global.localStorage = undefined;

// Expose Node.js native structuredClone to Jest's test environment
// Node.js 17+ has native support, but Jest's vm context doesn't inherit it
global.structuredClone = structuredClone;

// Mock expo-asset to prevent file system access issues
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({ uri: 'mock-asset-uri' })),
    loadAsync: jest.fn(() => Promise.resolve()),
  },
}));

// Mock Expo modules
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
  Link: 'Link',
}));

// Mock react-native-webview to avoid native module access in Jest.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: (props) => React.createElement('WebView', props),
  };
});

// Mock AsyncStorage for test environment
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  flushGetRequests: jest.fn(),
}));

// Mock useColorScheme for consistent test results. Individual suites can 
// unmock '@/hooks/useColorScheme' when they need the real implementation.
// Default to 'dark' mode for tests as it is the app default.
const mockUseColorScheme = jest.fn(() => 'dark');

jest.mock('@/hooks/useColorScheme', () => ({
  __esModule: true,
  useColorScheme: mockUseColorScheme,
}));

// Mock useSettings from SettingsContext for test environment
jest.mock('@/context/SettingsContext', () => {
  const React = require('react');
  return {
    useSettings: jest.fn(() => ({
      units: 'metric',
      colorModeOverride: 'system',
      colormap: 'viridis',
      circularColormap: 'twilight_90',
      cbMode: null,
      shapesEnabled: false,
      markerOutlineEnabled: false,
      globeViewEnabled: false,
      setGlobeViewEnabled: jest.fn(),
    })),
    // Mirrors runtime fallback behavior for suites rendering components outside
    // SettingsProvider (for example isolated/unit-level tests).
    useOptionalSettings: jest.fn(() => ({
      units: 'metric',
      colorModeOverride: 'system',
      colormap: 'viridis',
      circularColormap: 'twilight_90',
      cbMode: null,
      shapesEnabled: false,
      markerOutlineEnabled: false,
      globeViewEnabled: false,
      setGlobeViewEnabled: jest.fn(),
    })),
    /**
     * @param {{ children: React.ReactNode }} props
     * @returns {React.ReactNode}
     */
    SettingsProvider: (props) => props.children,
  };
});
