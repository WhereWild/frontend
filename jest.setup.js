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

// Mock useColorScheme for consistent test results. Individual suites can 
// unmock '@/hooks/useColorScheme' when they need the real implementation.
// Default to 'dark' mode for tests as it is the app default.
const mockUseColorScheme = jest.fn(() => 'dark');

jest.mock('@/hooks/useColorScheme', () => ({
  __esModule: true,
  useColorScheme: mockUseColorScheme,
}));
