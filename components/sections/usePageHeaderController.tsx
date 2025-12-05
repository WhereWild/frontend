import {
  IconChevronLeft,
  IconHelpCircle,
  IconInfo,
  IconSettings,
} from '@/assets/icons';
import { EnvironmentFlags } from '@/constants/environment';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useIsCompact } from '@/hooks/useResponsive';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../buttons/IconButton';
import { ThemedText } from '../text/ThemedText';
import { pageHeaderStyles as styles } from './PageHeader.styles';
import type { ColorPalette, PageHeaderAction } from './PageHeader.types';

export const PageHeaderActionIds = {
  help: 'help',
  about: 'about',
  settings: 'settings',
} as const;

export type PageHeaderControllerOptions = {
  title: string;
  logoSource: ImageSourcePropType;
  logoAccessibilityLabel?: string;
  actions?: PageHeaderAction[];
  showMenuButton: boolean;
  onMenuPress?: () => void;
  style?: StyleProp<ViewStyle>;
  onSubmitSearchProp?: (query: string) => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
};

export type PageHeaderControllerResult = {
  palette: ColorPalette;
  isCompact: boolean;
  mobileMenuExpanded: boolean;
  filterButtonDisabled: boolean;
  resolvedActions: PageHeaderAction[];
  handleSubmitSearch: (query: string) => void;
  handleBackPress: () => void;
  navigateHome: () => void;
  getLogoAccessibilityLabel: (useBackLabel: boolean) => string;
  logoContent: React.ReactNode;
  logoTitleContent: React.ReactNode | null;
  backButtonContent: React.ReactNode;
  insetWrapperStyle: ViewStyle;
  showNativeBackButton: boolean;
  handleMenuPress: () => void;
  dismissMobileMenu: () => void;
};

export function usePageHeaderController({
  title,
  logoSource,
  logoAccessibilityLabel,
  actions,
  showMenuButton,
  onMenuPress,
  style,
  onSubmitSearchProp,
  showBackButton,
  onBackPress,
}: PageHeaderControllerOptions): PageHeaderControllerResult {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const router = useRouter();
  const pathname = usePathname();
  const isCompact = useIsCompact();
  const isNativeMobile = Platform.OS !== 'web' && isCompact;
  const safeAreaInsets = useSafeAreaInsets();
  const topInset = isNativeMobile ? safeAreaInsets.top : 0;
  const canNavigateBack = router.canGoBack();
  const isOnRootPath = pathname === '/';
  const fallbackCanNavigateBack = canNavigateBack || !isOnRootPath;
  const resolvedCanNavigateBack = showBackButton ?? fallbackCanNavigateBack;
  const [mobileMenuExpanded, setMobileMenuExpanded] = React.useState(false);

  const navigateIfDifferent = React.useCallback(
    (targetPath: '/' | '/about' | '/settings') => {
      if (pathname !== targetPath) {
        router.push(targetPath);
      }
    },
    [pathname, router],
  );

  const navigateHome = React.useCallback(() => {
    navigateIfDifferent('/');
  }, [navigateIfDifferent]);

  const navigateToAbout = React.useCallback(() => {
    navigateIfDifferent('/about');
  }, [navigateIfDifferent]);

  const navigateToSettings = React.useCallback(() => {
    navigateIfDifferent('/settings');
  }, [navigateIfDifferent]);

  const handleSubmitSearch = React.useCallback(
    (query: string) => {
      if (onSubmitSearchProp) {
        onSubmitSearchProp(query);
        return;
      }
      router.push({ pathname: '/search', params: { query } });
    },
    [onSubmitSearchProp, router],
  );

  const handleBackPress = React.useCallback(() => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigateHome();
  }, [navigateHome, onBackPress, router]);

  const defaultActions = React.useMemo<PageHeaderAction[]>(
    () => [
      { id: PageHeaderActionIds.help, label: 'Help', icon: <IconHelpCircle /> },
      {
        id: PageHeaderActionIds.about,
        label: 'About',
        icon: <IconInfo />,
        onPress: navigateToAbout,
      },
      {
        id: PageHeaderActionIds.settings,
        label: 'Settings',
        icon: <IconSettings />,
        onPress: navigateToSettings,
      },
    ],
    [navigateToAbout, navigateToSettings],
  );

  const resolvedActions = React.useMemo(() => {
    const baseActions = actions ?? defaultActions;
    if (!EnvironmentFlags.disableSecondaryControls) {
      return baseActions;
    }
    return baseActions.map((action) => {
      const actionId = action.id ?? action.label;
      if (actionId === PageHeaderActionIds.help) {
        return { ...action, disabled: true, onPress: undefined };
      }
      return action;
    });
  }, [actions, defaultActions]);

  const filterButtonDisabled = EnvironmentFlags.disableSecondaryControls;

  React.useEffect(() => {
    if (!isCompact || !showMenuButton) {
      setMobileMenuExpanded(true);
      return;
    }
    setMobileMenuExpanded(false);
  }, [isCompact, showMenuButton]);

  const handleMenuPress = React.useCallback(() => {
    setMobileMenuExpanded((prev) => !prev);
    onMenuPress?.();
  }, [onMenuPress]);

  const dismissMobileMenu = React.useCallback(() => {
    if (!showMenuButton) {
      return;
    }
    setMobileMenuExpanded(false);
  }, [showMenuButton]);

  const defaultLogoAccessibilityLabel = `${title} – Go to home`;
  const defaultBackAccessibilityLabel = 'Go back';
  const getLogoAccessibilityLabel = React.useCallback(
    (useBackLabel: boolean) =>
      logoAccessibilityLabel ??
      (useBackLabel ? defaultBackAccessibilityLabel : defaultLogoAccessibilityLabel),
    [defaultBackAccessibilityLabel, defaultLogoAccessibilityLabel, logoAccessibilityLabel],
  );

  const logoContent = React.useMemo(
    () => (
      <Image
        source={logoSource}
        style={[styles.logo, isCompact ? styles.logoMobile : undefined]}
        resizeMode="contain"
        accessibilityLabel="WhereWild logo"
      />
    ),
    [isCompact, logoSource],
  );

  const logoTitleContent = React.useMemo(() => {
    if (isCompact) {
      return null;
    }
    return (
      <ThemedText variant="heading" style={{ color: palette.text.brand.default }}>
        {title}
      </ThemedText>
    );
  }, [isCompact, palette.text.brand.default, title]);

  const backButtonContent = React.useMemo(
    () => (
      <IconButton
        variant="subtle"
        icon={<IconChevronLeft />}
        accessibilityLabel={defaultBackAccessibilityLabel}
        onPress={handleBackPress}
      />
    ),
    [handleBackPress],
  );

  const headerBackgroundColor = React.useMemo(() => {
    const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
    if (flattenedStyle?.backgroundColor) {
      return flattenedStyle.backgroundColor as string;
    }
    return palette.background.default.secondary;
  }, [palette.background.default.secondary, style]);

  const insetWrapperStyle = React.useMemo<ViewStyle>(
    () => ({ paddingTop: topInset, backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor, topInset],
  );

  // Mobile web already exposes back navigation in browser chrome, so the header only
  // renders an explicit back button on native platforms.
  const showNativeBackButton = isNativeMobile && resolvedCanNavigateBack;

  return {
    palette,
    isCompact,
    mobileMenuExpanded,
    filterButtonDisabled,
    resolvedActions,
    handleSubmitSearch,
    handleBackPress,
    navigateHome,
    getLogoAccessibilityLabel,
    logoContent,
    logoTitleContent,
    backButtonContent,
    insetWrapperStyle: insetWrapperStyle as ViewStyle,
    showNativeBackButton,
    handleMenuPress,
    dismissMobileMenu,
  };
}
