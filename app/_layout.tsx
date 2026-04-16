import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import Head from 'expo-router/head';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  Domine_400Regular,
  Domine_600SemiBold,
  Domine_700Bold,
} from '@expo-google-fonts/domine';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  IconHome,
  IconHelpCircle,
  IconInfo,
  IconSearch,
  IconSettings,
} from '@/assets/icons';
import {
  NavigationBar,
  TopAppBar,
  WebPageHeader,
  type NavigationBarProps,
} from '@/components';
import {
  NativePortalHost,
  NativePortalProvider,
} from '@/components/NativePortalHost';
import { Colors, Size, Time } from '@/constants/theme';
import {
  LayoutChromeProvider,
  useLayoutChrome,
} from '@/context/LayoutChromeContext';
import { SettingsProvider } from '@/context/SettingsContext';
import {
  resolveHeaderConfigForRoute,
  WebPageHeaderProvider,
  useWebPageHeaderConfig,
} from '@/context/WebPageHeaderContext';
import {
  NativeTopAppBarProvider,
  resolveNativeTopAppBarConfigForRoute,
  useNativeTopAppBarConfig,
} from '@/context/NativeTopAppBarContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const TOP_LEVEL_PATHS = [
  '/',
  '/about',
  '/help',
  '/search',
  '/settings',
] as const;
const NOOP = () => {};
const NOOP_SEARCH_HANDLER = (_value: string) => {};
const NATIVE_STACK_DEFAULT_ANIMATION = 'none' as const;
const SPECIES_STACK_ANIMATION = 'fade' as const;
const WEB_SCROLL_ROOT_STYLE_ID = 'wherewild-web-scroll-root-override';
const WEB_HEADER_HEIGHT_DESKTOP = Size.space['1600'] + Size.space['200'] * 2;
const WEB_HEADER_HEIGHT_COMPACT =
  Size.control.dimension.large + Size.space['400'] * 2;

// Expo/RN Web injects a fixed-height root with hidden body overflow. On mobile Safari
// that turns page scroll into a trapped inner scroller, so we override the root chain
// back to document scrolling and keep the root background aligned with the active theme.
const buildWebScrollRootCss = (backgroundColor: string) => `
  html,
  body {
    height: auto !important;
    min-height: 100% !important;
    background-color: ${backgroundColor} !important;
  }

  html {
    overflow-x: hidden !important;
    overflow-y: auto !important;
  }

  body {
    overflow: visible !important;
  }

  #root,
  #root > div,
  #root > div > div {
    display: block !important;
    height: auto !important;
    min-height: 100% !important;
    flex: 0 0 auto !important;
    background-color: ${backgroundColor} !important;
  }
`;

type TopLevelPath = (typeof TOP_LEVEL_PATHS)[number];

const TOP_LEVEL_PATH_SET: ReadonlySet<string> = new Set(TOP_LEVEL_PATHS);

const isTopLevelPath = (value: string): value is TopLevelPath =>
  TOP_LEVEL_PATH_SET.has(value);

const isSpeciesPath = (value: string): value is `/species/${string}` =>
  value.startsWith('/species/');

const toHistoryHref = (route: string): Href | null => {
  if (isTopLevelPath(route)) {
    return route;
  }

  if (!isSpeciesPath(route)) {
    return null;
  }

  const identifier = route
    .replace('/species/', '')
    .split('/')
    .filter((segment) => segment.length > 0);

  if (identifier.length === 0) {
    return null;
  }

  return {
    pathname: '/species/[...identifier]',
    params: { identifier },
  };
};

const buildInitialTabRouteHistory = (): Record<TopLevelPath, string[]> => ({
  '/': ['/'],
  '/about': ['/about'],
  '/help': ['/help'],
  '/search': ['/search'],
  '/settings': ['/settings'],
});

const hasCanGoBack = (value: unknown): value is { canGoBack: () => boolean } =>
  typeof value === 'object' &&
  value !== null &&
  'canGoBack' in value &&
  typeof (value as { canGoBack?: unknown }).canGoBack === 'function';

const hasDismissAll = (value: unknown): value is { dismissAll: () => void } =>
  typeof value === 'object' &&
  value !== null &&
  'dismissAll' in value &&
  typeof (value as { dismissAll?: unknown }).dismissAll === 'function';

function RootLayoutWebFrame() {
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const responsive = useResponsive();
  const { height: viewportHeight } = useWindowDimensions();
  const { config } = useWebPageHeaderConfig();
  const { webHeaderHeight, setWebHeaderHeight } = useLayoutChrome();
  const resolvedConfig = resolveHeaderConfigForRoute(pathname, config);
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const webHeaderThemeColorLight = Colors.light.background.default.secondary;
  const webHeaderThemeColorDark = Colors.dark.background.default.secondary;
  const rootBackgroundColor = Colors[mode].background.default.default;
  const fallbackWebHeaderHeight =
    responsive.breakpoint === 'desktop'
      ? WEB_HEADER_HEIGHT_DESKTOP
      : WEB_HEADER_HEIGHT_COMPACT;
  // We need an initial offset before the header measures so first paint does not slide
  // page content under the fixed header on web.
  const resolvedWebHeaderHeight =
    webHeaderHeight > 0 ? webHeaderHeight : fallbackWebHeaderHeight;
  const resolvedWebShellMinHeight = Math.max(viewportHeight, 0);
  const resolvedWebContentMinHeight = Math.max(
    0,
    viewportHeight - resolvedWebHeaderHeight,
  );
  const webScrollRootCss = useMemo(
    () => buildWebScrollRootCss(rootBackgroundColor),
    [rootBackgroundColor],
  );
  const handleHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setWebHeaderHeight(event.nativeEvent.layout.height);
    },
    [setWebHeaderHeight],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    let styleElement = document.getElementById(
      WEB_SCROLL_ROOT_STYLE_ID,
    ) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = WEB_SCROLL_ROOT_STYLE_ID;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = webScrollRootCss;

    return () => {
      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [webScrollRootCss]);

  return (
    <>
      <Head>
        <meta
          name='theme-color'
          content={webHeaderThemeColorLight}
          media='(prefers-color-scheme: light)'
        />
        <meta
          name='theme-color'
          content={webHeaderThemeColorDark}
          media='(prefers-color-scheme: dark)'
        />
        <style>{webScrollRootCss}</style>
      </Head>
      <View
        style={[styles.webAppShell, { minHeight: resolvedWebShellMinHeight }]}
      >
        {/* Sticky was unreliable in this RN Web layout tree; a fixed wrapper plus measured
            content offset keeps the header pinned consistently across Safari/WebKit. */}
        <View style={styles.webHeaderSlot}>
          <WebPageHeader
            showFilterButton={resolvedConfig.showFilterButton}
            onFilterPress={resolvedConfig.onFilterPress}
            filterLabel={resolvedConfig.filterLabel}
            showResetFilterButton={resolvedConfig.showResetFilterButton}
            onResetFilterPress={resolvedConfig.onResetFilterPress}
            showSearchResultsDropdown={resolvedConfig.showSearchResultsDropdown}
            searchQuery={resolvedConfig.searchQuery}
            onSearchQueryChange={resolvedConfig.onSearchQueryChange}
            filterParams={resolvedConfig.filterParams}
            onLayout={handleHeaderLayout}
          />
        </View>
        <View
          style={[
            styles.webContent,
            {
              paddingTop: resolvedWebHeaderHeight,
              minHeight: resolvedWebContentMinHeight,
            },
          ]}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: Time.duration.short,
            }}
          />
        </View>
        <NativePortalHost />
      </View>
    </>
  );
}

function RootLayoutNativeFrame() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const { config: nativeTopAppBarConfig } = useNativeTopAppBarConfig();
  const resolvedNativeTopAppBarConfig = resolveNativeTopAppBarConfigForRoute(
    pathname,
    nativeTopAppBarConfig,
  );
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const rootBackgroundColor = Colors[mode].background.default.default;
  const handlePressBack = useCallback(() => {
    router.back();
  }, [router]);
  // UI highlight state must be explicit so route restores across tabs immediately
  // reflect the intended active tab, even before deeper screens finish rendering.
  const [activeTabPath, setActiveTabPath] = useState<TopLevelPath>('/');
  // Keeps the latest top-level tab context so nested routes (e.g. species pages)
  // can still be attributed to the tab that owns them.
  const lastTopLevelPathRef = useRef<TopLevelPath>('/');
  // During cross-tab restores we temporarily pin the destination tab so the next
  // route update is recorded under the correct tab instead of the previous one.
  const pendingTargetTabRef = useRef<TopLevelPath | null>(null);
  // Stores a per-tab route stack so each tab can restore its own in-tab history
  // (not just a single last route) when users switch away and come back.
  const tabRouteHistoryRef = useRef<Record<TopLevelPath, string[]>>(
    buildInitialTabRouteHistory(),
  );

  const rememberRouteForTab = useCallback(
    (tab: TopLevelPath, route: string) => {
      const history = tabRouteHistoryRef.current[tab];
      const currentTop = history[history.length - 1];

      if (currentTop === route) {
        return;
      }

      const existingIndex = history.lastIndexOf(route);

      if (existingIndex >= 0) {
        // When navigating back within a tab, truncate this tab's history to the target entry
        // so any forward routes that users can no longer reach are removed from the stack.
        tabRouteHistoryRef.current[tab] = history.slice(0, existingIndex + 1);
        return;
      }

      if (isTopLevelPath(route)) {
        tabRouteHistoryRef.current[tab] = [route];
        return;
      }

      tabRouteHistoryRef.current[tab] = [...history, route];
    },
    [],
  );

  useEffect(() => {
    if (isTopLevelPath(pathname)) {
      lastTopLevelPathRef.current = pathname;
      rememberRouteForTab(pathname, pathname);
      pendingTargetTabRef.current = null;
      setActiveTabPath(pathname);
      return;
    }

    // Non-top-level routes are associated with whichever tab initiated them.
    // This preserves tab ownership for deep-linked screens while navigating.
    const associatedTab =
      pendingTargetTabRef.current ?? lastTopLevelPathRef.current;
    lastTopLevelPathRef.current = associatedTab;
    rememberRouteForTab(associatedTab, pathname);
    pendingTargetTabRef.current = null;
    setActiveTabPath(associatedTab);
  }, [pathname, rememberRouteForTab]);

  const navigateIfDifferent = useCallback(
    (targetPath: TopLevelPath) => {
      if (activeTabPath === targetPath) {
        return;
      }

      const targetHistory = tabRouteHistoryRef.current[targetPath] ?? [
        targetPath,
      ];
      const targetRoute = targetHistory[targetHistory.length - 1] ?? targetPath;

      if (pathname === targetRoute) {
        return;
      }

      pendingTargetTabRef.current = targetPath;

      // Clearing stack on real tab switches prevents back gestures from jumping
      // across tabs into previously viewed tab stacks.
      if (hasCanGoBack(router) && router.canGoBack() && hasDismissAll(router)) {
        router.dismissAll();
      }

      if (targetRoute === targetPath) {
        router.replace(targetPath);
        return;
      }

      // Rebuild the destination tab stack from root so back gestures work
      // within that tab after restore (root -> nested -> nested...).
      router.replace(targetPath);
      targetHistory.slice(1).forEach((route) => {
        const href = toHistoryHref(route);
        if (href) {
          router.push(href);
        }
      });
    },
    [activeTabPath, pathname, router],
  );

  const nativeTopAppBar = React.useMemo(() => {
    if (pathname === '/search') {
      return (
        <TopAppBar
          variant='search'
          searchValue={resolvedNativeTopAppBarConfig.searchValue ?? ''}
          onSearchValueChange={
            resolvedNativeTopAppBarConfig.onSearchValueChange ??
            NOOP_SEARCH_HANDLER
          }
          onSubmitSearch={
            resolvedNativeTopAppBarConfig.onSubmitSearch ?? NOOP_SEARCH_HANDLER
          }
          searchPlaceholder={resolvedNativeTopAppBarConfig.searchPlaceholder}
          primaryAction={resolvedNativeTopAppBarConfig.primaryAction}
          secondaryAction={resolvedNativeTopAppBarConfig.secondaryAction}
        />
      );
    }

    if (isSpeciesPath(pathname)) {
      return (
        <TopAppBar
          variant='page'
          title='Species'
          onPressBack={handlePressBack}
          primaryAction={{ isVisible: false }}
          secondaryAction={{ isVisible: false }}
        />
      );
    }

    if (pathname === '/acknowledgements') {
      return (
        <TopAppBar
          variant='page'
          title='Acknowledgements'
          onPressBack={handlePressBack}
          primaryAction={{ isVisible: false }}
          secondaryAction={{ isVisible: false }}
        />
      );
    }

    if (isTopLevelPath(pathname)) {
      return (
        <TopAppBar
          variant='home'
          title='WhereWild'
          onPressLogo={NOOP}
          primaryAction={{ isVisible: false }}
          secondaryAction={{ isVisible: false }}
        />
      );
    }

    return null;
  }, [handlePressBack, pathname, resolvedNativeTopAppBarConfig]);

  const navigationTabs: NonNullable<NavigationBarProps['tabs']> = useMemo(
    () => [
      {
        key: 'home',
        label: 'Home',
        icon: IconHome,
        state: activeTabPath === '/' ? 'active' : ('default' as const),
        onPress: () => navigateIfDifferent('/'),
        accessibilityLabel: 'Home tab',
      },
      {
        key: 'search',
        label: 'Search',
        icon: IconSearch,
        state: activeTabPath === '/search' ? 'active' : ('default' as const),
        onPress: () => navigateIfDifferent('/search'),
        accessibilityLabel: 'Search tab',
      },
      {
        key: 'about',
        label: 'About',
        icon: IconInfo,
        state: activeTabPath === '/about' ? 'active' : ('default' as const),
        onPress: () => navigateIfDifferent('/about'),
        accessibilityLabel: 'About tab',
      },
      {
        key: 'help',
        label: 'Help',
        icon: IconHelpCircle,
        state: activeTabPath === '/help' ? 'active' : ('default' as const),
        onPress: () => navigateIfDifferent('/help'),
        accessibilityLabel: 'Help tab',
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: IconSettings,
        state: activeTabPath === '/settings' ? 'active' : ('default' as const),
        onPress: () => navigateIfDifferent('/settings'),
        accessibilityLabel: 'Settings tab',
      },
    ],
    [activeTabPath, navigateIfDifferent],
  );

  return (
    <View style={[styles.appShell, { backgroundColor: rootBackgroundColor }]}>
      {nativeTopAppBar}
      <View style={styles.content}>
        {/* Keep native route transitions disabled by default to avoid cross-route
            jank; only species screens opt into fade for in-flow detail transitions. */}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: NATIVE_STACK_DEFAULT_ANIMATION,
            contentStyle: { backgroundColor: rootBackgroundColor },
          }}
        >
          <Stack.Screen
            name='species/[...identifier]'
            options={{
              animation: SPECIES_STACK_ANIMATION,
              animationDuration: Time.duration.short,
            }}
          />
        </Stack>
      </View>
      <NavigationBar tabs={navigationTabs} />
      <NativePortalHost />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Domine_400Regular,
    Domine_600SemiBold,
    Domine_700Bold,
    JetBrainsMono_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SettingsProvider>
      <NativePortalProvider>
        <LayoutChromeProvider>
          <WebPageHeaderProvider>
            <NativeTopAppBarProvider>
              {Platform.OS === 'web' ? (
                <RootLayoutWebFrame />
              ) : (
                <RootLayoutNativeFrame />
              )}
            </NativeTopAppBarProvider>
          </WebPageHeaderProvider>
        </LayoutChromeProvider>
      </NativePortalProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  webAppShell: {
    width: '100%',
  },
  webHeaderSlot: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 9999,
  },
  webContent: {
    flex: 1,
    width: '100%',
  },
});
