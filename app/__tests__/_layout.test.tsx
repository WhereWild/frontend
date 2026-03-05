import React from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RootLayout from '../_layout';
import { useFonts } from 'expo-font';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

const recordedStackProps: any[] = [];
const recordedHeaderProps: any[] = [];
let mockPathname = '/';
let mockHeaderConfig: any = {};

function mockStack(props: any) {
  recordedStackProps.push(props);
  return <View testID="app-stack" />;
}

jest.mock('expo-router', () => ({
  Stack: mockStack,
  usePathname: () => mockPathname,
}));

jest.mock('@/components', () => ({
  WebPageHeader: (props: any) => {
    const mockReact = jest.requireActual('react') as typeof React;
    const mockReactNative = jest.requireActual('react-native') as typeof import('react-native');
    recordedHeaderProps.push(props);
    return mockReact.createElement(mockReactNative.View, { testID: 'global-header' });
  },
}));

jest.mock('@/context/WebPageHeaderContext', () => {
  const actual = jest.requireActual('@/context/WebPageHeaderContext');
  return {
    ...actual,
    WebPageHeaderProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useWebPageHeaderConfig: () => ({
      config: mockHeaderConfig,
      setConfig: jest.fn(),
      resetConfig: jest.fn(),
    }),
  };
});

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

describe('Root layout', () => {
  afterEach(() => {
    mockUseFonts.mockReset();
    recordedStackProps.length = 0;
    recordedHeaderProps.length = 0;
    mockPathname = '/';
    mockHeaderConfig = {};
  });

  it('renders nothing until fonts are loaded', () => {
    mockUseFonts.mockReturnValue([false, null]);

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('app-stack')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({ headerShown: false });
  });

  it('strips stale search-specific header controls on non-search routes', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockPathname = '/settings';
    mockHeaderConfig = {
      showFilterButton: true,
      onFilterPress: jest.fn(),
      filterLabel: 'Filter',
      showResetFilterButton: true,
      onResetFilterPress: jest.fn(),
      showSearchResultsDropdown: false,
      initialQuery: 'fox',
      filterParams: { ancestorTaxonId: 212 },
      onSearchingChanged: jest.fn(),
      onSearchResultsChanged: jest.fn(),
    };

    render(<RootLayout />);

    const headerProps = recordedHeaderProps.at(-1);
    expect(headerProps.showFilterButton).toBe(false);
    expect(headerProps.onFilterPress).toBeUndefined();
    expect(headerProps.showResetFilterButton).toBe(false);
    expect(headerProps.onResetFilterPress).toBeUndefined();
    expect(headerProps.showSearchResultsDropdown).toBe(true);
    expect(headerProps.initialQuery).toBeUndefined();
    expect(headerProps.filterParams).toBeUndefined();
    expect(headerProps.onSearchingChanged).toBeUndefined();
    expect(headerProps.onSearchResultsChanged).toBeUndefined();
  });
});
