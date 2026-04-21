import React from 'react';
import { Colors } from '@/constants/theme';
import { Platform, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { render, screen, waitFor } from '@testing-library/react-native';
import RootLayout, { unstable_settings } from '../_layout';
import { useFonts } from 'expo-font';
import { usePathname, useRouter } from 'expo-router';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    marginHorizontal: 32,
    gap: 24,
  }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const recordedStackProps: any[] = [];
const recordedStackScreenProps: any[] = [];
const recordedHeaderProps: any[] = [];
const recordedTopAppBarProps: any[] = [];
const mockUseNativeHomeTabs = jest.fn();
let mockHeaderConfig: any = {};
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;
const mockNavigationBar = jest.fn((_props?: unknown) => (
  <View testID='mock-navigation-bar' />
));

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

function mockStack(props: any) {
  recordedStackProps.push(props);
  return <View testID='app-stack'>{props.children}</View>;
}

mockStack.Screen = function mockStackScreen(props: any) {
  recordedStackScreenProps.push(props);
  return null;
};

jest.mock('expo-router', () => ({
  Stack: mockStack,
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/components', () => ({
  WebPageHeader: (props: any) => {
    const mockReact = jest.requireActual('react') as typeof React;
    const mockReactNative = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');
    recordedHeaderProps.push(props);
    return mockReact.createElement(mockReactNative.View, {
      testID: 'global-header',
    });
  },
  NavigationBar: (props: unknown) => mockNavigationBar(props),
  TopAppBar: (props: any) => {
    const mockReact = jest.requireActual('react') as typeof React;
    const mockReactNative = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');
    recordedTopAppBarProps.push(props);
    return mockReact.createElement(mockReactNative.View, {
      testID: 'mock-top-app-bar',
    });
  },
}));

jest.mock('@/context/WebPageHeaderContext', () => {
  const actual = jest.requireActual('@/context/WebPageHeaderContext');
  return {
    ...actual,
    WebPageHeaderProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useWebPageHeaderConfig: () => ({
      config: mockHeaderConfig,
      setConfig: jest.fn(),
      resetConfig: jest.fn(),
    }),
  };
});

jest.mock('@/context/NativeHomeTabsContext', () => ({
  NativeHomeTabsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useNativeHomeTabs: () => mockUseNativeHomeTabs(),
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

type NavTab = {
  key: string;
  state?: 'default' | 'active' | 'pressed';
  onPress?: () => void;
};

const getRenderedTabs = (): NavTab[] => {
  const lastCall = mockNavigationBar.mock.calls[
    mockNavigationBar.mock.calls.length - 1
  ] as unknown[] | undefined;
  if (!lastCall) {
    return [];
  }

  const props = lastCall[0] as { tabs?: NavTab[] } | undefined;
  if (!props) {
    return [];
  }

  return props.tabs ?? [];
};

const getTabByKey = (key: string): NavTab | undefined =>
  getRenderedTabs().find((tab) => tab.key === key);

describe('Root layout', () => {
  const mockBack = jest.fn();
  const mockDismissTo = jest.fn();
  const mockReplace = jest.fn();
  const mockPush = jest.fn();
  const mockDismissAll = jest.fn();
  const mockCanGoBack = jest.fn(() => false);

  const createRouterMock = () => ({
    back: mockBack,
    dismissTo: mockDismissTo,
    replace: mockReplace,
    push: mockPush,
    dismissAll: mockDismissAll,
    canGoBack: mockCanGoBack,
  });

  afterEach(() => {
    restorePlatformOS();
    mockUseFonts.mockReset();
    mockUseRouter.mockReset();
    mockUsePathname.mockReset();
    mockUseColorScheme.mockReset();
    mockUseColorScheme.mockReturnValue('dark');
    mockNavigationBar.mockReset();
    mockBack.mockReset();
    mockDismissTo.mockReset();
    mockReplace.mockReset();
    mockPush.mockReset();
    mockDismissAll.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    recordedStackProps.length = 0;
    recordedStackScreenProps.length = 0;
    recordedHeaderProps.length = 0;
    recordedTopAppBarProps.length = 0;
    mockUseNativeHomeTabs.mockReset();
    mockHeaderConfig = {};
  });

  beforeEach(() => {
    mockUseNativeHomeTabs.mockReturnValue({
      hasActiveFilter: false,
      isFilterVisible: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });
  });

  it('renders nothing until fonts are loaded', () => {
    mockUseFonts.mockReturnValue([false, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('app-stack')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');
    mockUseColorScheme.mockReturnValue('dark');

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({
      headerShown: false,
      animation: 'none',
      gestureEnabled: false,
      contentStyle: { backgroundColor: Colors.dark.background.default.default },
    });
    expect(unstable_settings.initialRouteName).toBe('index');
    expect(recordedStackScreenProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'about',
          options: expect.objectContaining({ gestureEnabled: true }),
        }),
        expect.objectContaining({
          name: 'acknowledgements',
          options: expect.objectContaining({ gestureEnabled: true }),
        }),
        expect.objectContaining({
          name: 'upload',
          options: expect.objectContaining({ gestureEnabled: true }),
        }),
        expect.objectContaining({
          name: 'species/[...identifier]',
          options: expect.objectContaining({
            animation: 'fade',
            animationDuration: expect.any(Number),
            gestureEnabled: true,
          }),
        }),
      ]),
    );
  });

  it('applies the default background color at the native root', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(<RootLayout />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected RootLayout to render a single root view');
    }

    const styles = tree.props.style;
    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: Colors.light.background.default.default,
        }),
      ]),
    );
  });

  it('does not render web header on native layout', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/settings');
    mockHeaderConfig = {
      showFilterButton: true,
      onFilterPress: jest.fn(),
      filterLabel: 'Filter',
      showResetFilterButton: true,
      onResetFilterPress: jest.fn(),
      showSearchResultsDropdown: false,
      searchQuery: 'fox',
      filterParams: { withinTaxonId: 212 },
    };

    render(<RootLayout />);

    expect(recordedHeaderProps).toHaveLength(0);
    expect(screen.getByTestId('mock-top-app-bar')).toBeTruthy();
  });

  it('renders web header on web layout', () => {
    setPlatformOS('web');

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/search');
    mockHeaderConfig = {
      showFilterButton: true,
      filterLabel: 'Filter',
      showResetFilterButton: true,
      showSearchResultsDropdown: false,
      searchQuery: 'fox',
      filterParams: { withinTaxonId: 212 },
    };

    render(<RootLayout />);

    expect(screen.getByTestId('global-header')).toBeTruthy();
    const headerProps = recordedHeaderProps.at(-1);
    expect(headerProps.showFilterButton).toBe(true);
    expect(headerProps.filterLabel).toBe('Filter');
    expect(headerProps.searchQuery).toBe('fox');
    expect(headerProps.filterParams).toEqual({ withinTaxonId: 212 });
    expect(screen.queryByTestId('mock-navigation-bar')).toBeNull();
    expect(screen.queryByTestId('mock-top-app-bar')).toBeNull();
  });

  it('uses route-specific top app bar titles for native top-level and stacked pages', () => {
    const pathnameState = {
      value: '/',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('home');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Active Near You');
    expect(recordedTopAppBarProps.at(-1)?.primaryAction?.isVisible).toBe(true);
    expect(recordedTopAppBarProps.at(-1)?.secondaryAction?.isVisible).toBe(
      false,
    );
    expect(recordedTopAppBarProps.at(-1)?.primaryAction?.buttonLabel).toBe(
      'Filter',
    );

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('page');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Species');

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('page');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('About');

    pathnameState.value = '/upload';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('page');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Upload Custom Data');

    pathnameState.value = '/map';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('home');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Local Map');
    expect(recordedTopAppBarProps.at(-1)?.primaryAction?.isVisible).toBe(true);
    expect(recordedTopAppBarProps.at(-1)?.secondaryAction?.isVisible).toBe(
      false,
    );
    expect(recordedTopAppBarProps.at(-1)?.primaryAction?.buttonLabel).toBe(
      'Filter',
    );

    pathnameState.value = '/help';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('home');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Help');
    expect(recordedTopAppBarProps.at(-1)?.primaryAction?.isVisible).toBe(false);

    pathnameState.value = '/settings';
    rerender(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('home');
    expect(recordedTopAppBarProps.at(-1)?.title).toBe('Settings');
  });

  it('shows the native reset filter button when the homepage filter is non-default', () => {
    const resetGroup = jest.fn();

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');
    mockUseNativeHomeTabs.mockReturnValue({
      hasActiveFilter: true,
      isFilterVisible: true,
      setActiveGroup: resetGroup,
      toggleFilterVisibility: jest.fn(),
    });

    render(<RootLayout />);

    expect(recordedTopAppBarProps.at(-1)?.secondaryAction?.isVisible).toBe(
      true,
    );
    expect(
      recordedTopAppBarProps.at(-1)?.secondaryAction?.accessibilityLabel,
    ).toBe('Reset filters');

    recordedTopAppBarProps.at(-1)?.secondaryAction?.onPress?.();
    expect(resetGroup).toHaveBeenCalledWith('all');
  });

  it('renders shared search top app bar on search route', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/search');

    render(<RootLayout />);

    expect(screen.getByTestId('mock-top-app-bar')).toBeTruthy();
    expect(recordedTopAppBarProps.at(-1)?.variant).toBe('search');
  });

  it('keeps the previous top-level tab active on species routes', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    const searchTabBefore = getRenderedTabs().find(
      (tab) => tab.key === 'search',
    );
    expect(searchTabBefore?.state).toBe('active');

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    const searchTabAfter = getRenderedTabs().find(
      (tab) => tab.key === 'search',
    );
    const mapTabAfter = getRenderedTabs().find(
      (tab) => tab.key === 'local-map',
    );
    expect(searchTabAfter?.state).toBe('active');
    expect(mapTabAfter?.state).toBe('default');
  });

  it('defaults to Explore active when first route is a species detail path', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/species/123');

    render(<RootLayout />);

    expect(getTabByKey('explore')?.state).toBe('active');
    expect(getTabByKey('local-map')?.state).toBe('default');
    expect(getTabByKey('search')?.state).toBe('default');
    expect(getTabByKey('settings')?.state).toBe('default');
  });

  it.each(['/about', '/acknowledgements', '/upload'])(
    'keeps Settings active on first render when cold-started at %s',
    (ownedRoute) => {
      mockUseFonts.mockReturnValue([true, null]);
      mockUseRouter.mockReturnValue(createRouterMock() as never);
      mockUsePathname.mockReturnValue(ownedRoute);

      render(<RootLayout />);

      expect(getTabByKey('settings')?.state).toBe('active');
      expect(getTabByKey('explore')?.state).toBe('default');
    },
  );

  it('keeps Settings active when the native About page is pushed from settings', () => {
    const pathnameState = {
      value: '/settings',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    expect(getTabByKey('settings')?.state).toBe('active');
    expect(getTabByKey('local-map')?.state).toBe('default');
    expect(getTabByKey('search')?.state).toBe('default');
    expect(getTabByKey('explore')?.state).toBe('default');
  });

  it('keeps Settings active when native About-owned pages are cold-started directly', () => {
    const pathnameState = {
      value: '/about',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    expect(getTabByKey('settings')?.state).toBe('active');
    expect(getTabByKey('explore')?.state).toBe('default');

    pathnameState.value = '/acknowledgements';
    rerender(<RootLayout />);

    expect(getTabByKey('settings')?.state).toBe('active');
    expect(getTabByKey('explore')?.state).toBe('default');
  });

  it('tab presses dismissTo only when target path differs', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/search');

    render(<RootLayout />);

    getTabByKey('search')?.onPress?.();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();

    getTabByKey('local-map')?.onPress?.();
    expect(mockDismissTo).toHaveBeenCalledWith('/map');
    expect(mockPush).not.toHaveBeenCalled();

    getTabByKey('explore')?.onPress?.();
    expect(mockDismissTo).toHaveBeenCalledWith('/');

    getTabByKey('settings')?.onPress?.();
    expect(mockDismissTo).toHaveBeenCalledWith('/settings');
  });

  it('does not re-navigate when pressing inherited active tab on species route', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it('returns Settings-owned subpages to /settings when pressing the active Settings tab', () => {
    const pathnameState = {
      value: '/settings',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    getTabByKey('settings')?.onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/settings');
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it.each(['/acknowledgements', '/upload'])(
    'returns %s to /settings when pressing the active Settings tab',
    (ownedRoute) => {
      const pathnameState = {
        value: '/settings',
      } as { value: string };

      mockUseFonts.mockReturnValue([true, null]);
      mockUseRouter.mockReturnValue(createRouterMock() as never);
      mockUsePathname.mockImplementation(() => pathnameState.value);

      const { rerender } = render(<RootLayout />);

      pathnameState.value = ownedRoute;
      rerender(<RootLayout />);

      getTabByKey('settings')?.onPress?.();

      expect(mockReplace).toHaveBeenCalledWith('/settings');
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockDismissAll).not.toHaveBeenCalled();
    },
  );

  it.each(['/about', '/acknowledgements', '/upload'])(
    'falls back to /settings when pressing back from a cold-started %s page',
    (ownedRoute) => {
      mockUseFonts.mockReturnValue([true, null]);
      mockCanGoBack.mockReturnValue(false);
      mockUseRouter.mockReturnValue(createRouterMock() as never);
      mockUsePathname.mockReturnValue(ownedRoute);

      render(<RootLayout />);

      recordedTopAppBarProps.at(-1)?.onPressBack?.();

      expect(mockReplace).toHaveBeenCalledWith('/settings');
      expect(mockBack).not.toHaveBeenCalled();
    },
  );

  it('uses router.back on owned pages when native history exists', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockCanGoBack.mockReturnValue(true);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/about');

    render(<RootLayout />);

    recordedTopAppBarProps.at(-1)?.onPressBack?.();

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('restores each tab to its own latest route history', async () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/map';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockDismissTo).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith('/species/123');

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    await waitFor(() => {
      expect(getTabByKey('search')?.state).toBe('active');
      expect(getTabByKey('explore')?.state).toBe('default');
    });
  });

  it('restores all nested route layers for a tab', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123/photos';
    rerender(<RootLayout />);

    pathnameState.value = '/map';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockDismissTo).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith('/species/123');
    expect(mockPush).toHaveBeenCalledWith('/species/123/photos');
  });

  it('truncates restored tab history when user navigates back within that tab', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123/photos';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/map';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockDismissTo).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith('/species/123');
    expect(mockPush).not.toHaveBeenCalledWith('/species/123/photos');
  });

  it('switches tabs with dismissTo when back stack exists', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/species/123');
    mockCanGoBack.mockReturnValue(true);

    render(<RootLayout />);

    getTabByKey('local-map')?.onPress?.();

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockDismissTo).toHaveBeenCalledWith('/map');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
