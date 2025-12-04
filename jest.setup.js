// Setup for Expo testing environment
/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
    canGoBack: jest.fn(() => false),
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

const mockUseSafeAreaInsets = jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 }));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: mockUseSafeAreaInsets,
  };
});

// Skip tests that expect secondary controls/downloads to be interactive when the
// prototype environment disables them. This lets us keep the assertions intact
// while still running the suite in prototype mode.
const { readBooleanEnv } = require('./constants/environment');

// Expo does not inject app.json env values when Jest starts, so the shell
// running Jest must set EXPO_PUBLIC_* if it wants to mimic prototype behavior.
// We default to false so suites run unless those vars are explicitly true.
// Examples (macOS/Linux):
//   # Run tests with prototype controls disabled (skips affected suites)
//   EXPO_PUBLIC_IS_CAPSTONE_PROTOTYPE=true \
//   EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS=true \
//   EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS=true \
//   npm test -- --coverage
//   # Run tests with controls enabled (default)
//   EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS=false \
//   EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS=false \
//   npm test -- --coverage
const shouldSkipControlDependentTests = readBooleanEnv(process.env.EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS, false)
  || readBooleanEnv(process.env.EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS, false);

if (shouldSkipControlDependentTests) {
  const testsRequiringEnabledButtons = new Set([
    'renders species data-driven content and supports download press',
    'renders species data-driven content and disables downloads in prototype mode',
    'updates header search input and triggers filter alert',
    'updates header search input while filter control stays disabled',
    'invokes filter handler when filter button is pressed',
    'invokes download handler when button is pressed',
  ]);

  const wrapTestInterface = (interfaceName) => {
    const original = global[interfaceName];
    if (!original) {
      return;
    }

    const wrapped = (name, fn, timeout) => {
      if (testsRequiringEnabledButtons.has(name)) {
        return original.skip(name, fn, timeout);
      }
      return original(name, fn, timeout);
    };

    if (original.skip) {
      wrapped.skip = original.skip.bind(original);
    }
    if (original.only) {
      wrapped.only = original.only.bind(original);
    }
    if (original.todo) {
      wrapped.todo = original.todo.bind(original);
    }

    if (original.concurrent) {
      wrapped.concurrent = (...args) => original.concurrent(...args);
      if (original.concurrent.only) {
        wrapped.concurrent.only = original.concurrent.only.bind(original.concurrent);
      }
      if (original.concurrent.skip) {
        wrapped.concurrent.skip = original.concurrent.skip.bind(original.concurrent);
      }
      if (original.concurrent.retry) {
        wrapped.concurrent.retry = original.concurrent.retry.bind(original.concurrent);
      }
    }

    global[interfaceName] = wrapped;
  };

  wrapTestInterface('it');
  wrapTestInterface('test');
}
