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
    })),
    SettingsProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
