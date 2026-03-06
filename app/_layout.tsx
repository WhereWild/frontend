import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Domine_400Regular,
  Domine_600SemiBold,
  Domine_700Bold,
} from '@expo-google-fonts/domine';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  IconHome,
  IconInfo,
  IconSearch,
  IconSettings,
} from '@/assets/icons';
import {
  NavigationBar,
  WebPageHeader,
  type NavigationBarProps,
} from '@/components';
import { Time } from '@/constants/theme';
import { SettingsProvider } from '@/context/SettingsContext';
import {
  resolveHeaderConfigForRoute,
  WebPageHeaderProvider,
  useWebPageHeaderConfig,
} from '@/context/WebPageHeaderContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const TOP_LEVEL_PATHS = ['/', '/about', '/search', '/settings'] as const;

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
  '/search': ['/search'],
  '/settings': ['/settings'],
});

const hasCanGoBack = (value: unknown): value is { canGoBack: () => boolean } =>
  typeof value === 'object'
  && value !== null
  && 'canGoBack' in value
  && typeof (value as { canGoBack?: unknown }).canGoBack === 'function';

const hasDismissAll = (value: unknown): value is { dismissAll: () => void } =>
  typeof value === 'object'
  && value !== null
  && 'dismissAll' in value
  && typeof (value as { dismissAll?: unknown }).dismissAll === 'function';

function RootLayoutWebFrame() {
  const pathname = usePathname();
  const { config } = useWebPageHeaderConfig();
  const resolvedConfig = resolveHeaderConfigForRoute(pathname, config);

  return (
    <View style={styles.appShell}>
      <WebPageHeader
        showFilterButton={resolvedConfig.showFilterButton}
        onFilterPress={resolvedConfig.onFilterPress}
        filterLabel={resolvedConfig.filterLabel}
        showResetFilterButton={resolvedConfig.showResetFilterButton}
        onResetFilterPress={resolvedConfig.onResetFilterPress}
        showSearchResultsDropdown={resolvedConfig.showSearchResultsDropdown}
        initialQuery={resolvedConfig.initialQuery}
        filterParams={resolvedConfig.filterParams}
        onSearchingChanged={resolvedConfig.onSearchingChanged}
        onSearchResultsChanged={resolvedConfig.onSearchResultsChanged}
        onSearchContextChanged={resolvedConfig.onSearchContextChanged}
      />
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: Time.duration.short }} />
      </View>
    </View>
  );
}

function RootLayoutNativeFrame() {
  const router = useRouter();
  const pathname = usePathname();
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
  const tabRouteHistoryRef = useRef<Record<TopLevelPath, string[]>>(buildInitialTabRouteHistory());

  const rememberRouteForTab = useCallback((tab: TopLevelPath, route: string) => {
    const history = tabRouteHistoryRef.current[tab];
    const currentTop = history[history.length - 1];

    if (currentTop === route) {
      return;
    }

    const existingIndex = history.lastIndexOf(route);

    if (existingIndex >= 0) {
      tabRouteHistoryRef.current[tab] = history.slice(0, existingIndex + 1);
      return;
    }

    if (isTopLevelPath(route)) {
      tabRouteHistoryRef.current[tab] = [route];
      return;
    }

    tabRouteHistoryRef.current[tab] = [...history, route];
  }, []);

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
    const associatedTab = pendingTargetTabRef.current ?? lastTopLevelPathRef.current;
    lastTopLevelPathRef.current = associatedTab;
    rememberRouteForTab(associatedTab, pathname);
    pendingTargetTabRef.current = null;
    setActiveTabPath(associatedTab);
  }, [pathname, rememberRouteForTab]);

  const navigateIfDifferent = useCallback((targetPath: TopLevelPath) => {
    if (activeTabPath === targetPath) {
      return;
    }

    const targetHistory = tabRouteHistoryRef.current[targetPath] ?? [targetPath];
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
  }, [activeTabPath, pathname, router]);

  const navigationTabs: NonNullable<NavigationBarProps['tabs']> = useMemo(() => [
    {
      key: 'home',
      label: 'Home',
      icon: IconHome,
      state: activeTabPath === '/' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/'),
      accessibilityLabel: 'Home tab',
    },
    {
      key: 'search',
      label: 'Search',
      icon: IconSearch,
      state: activeTabPath === '/search' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/search'),
      accessibilityLabel: 'Search tab',
    },
    {
      key: 'about',
      label: 'Components',
      icon: IconInfo,
      state: activeTabPath === '/about' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/about'),
      accessibilityLabel: 'Component playground tab',
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: IconSettings,
      state: activeTabPath === '/settings' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/settings'),
      accessibilityLabel: 'Settings tab',
    },
  ], [activeTabPath, navigateIfDifferent]);

  return (
    <View style={styles.appShell}>
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: Time.duration.short }} />
      </View>
      <NavigationBar tabs={navigationTabs} />
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
      <WebPageHeaderProvider>
        {Platform.OS === 'web' ? <RootLayoutWebFrame /> : <RootLayoutNativeFrame />}
      </WebPageHeaderProvider>
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
});
