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
import { Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../buttons/IconButton';
import { ThemedText } from '../text/ThemedText';
import { pageHeaderStyles as styles } from './PageHeader.styles';
import type { PageHeaderAction, PageHeaderProps } from './PageHeader.types';
import { PageHeaderDesktop } from './PageHeaderDesktop';
import { PageHeaderMobile } from './PageHeaderMobile';
export type { PageHeaderAction, PageHeaderProps } from './PageHeader.types';

const DEFAULT_LOGO = require('@/assets/images/wherewild.png');
const PageHeaderActionIds = {
  help: 'help',
  about: 'about',
  settings: 'settings',
} as const;

export function PageHeader({
  title = 'WhereWild',
  logoSource = DEFAULT_LOGO,
  searchValue,
  onSearchChange,
  onSubmitSearch,
  searchPlaceholder = 'Search',
  searchInputProps,
  actions,
  showFilterButton = true,
  onFilterPress,
  filterLabel = 'Filter',
  filterButtonAccessibilityLabel = 'Filter search results',
  showMenuButton = true,
  onMenuPress,
  menuAccessibilityLabel = 'Toggle navigation menu',
  style,
  logoAccessibilityLabel,
}: PageHeaderProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const router = useRouter();
  const pathname = usePathname();
  const isCompact = useIsCompact();
  const isNativeMobile = Platform.OS !== 'web' && isCompact;
  const safeAreaInsets = useSafeAreaInsets();
  const canNavigateBack = router.canGoBack();
  const [mobileMenuExpanded, setMobileMenuExpanded] = React.useState(false);

  const navigateIfDifferent = React.useCallback((targetPath: '/' | '/about' | '/settings') => {
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  }, [pathname, router]);

  const navigateHome = React.useCallback(() => {
    navigateIfDifferent('/');
  }, [navigateIfDifferent]);

  const navigateToAbout = React.useCallback(() => {
    navigateIfDifferent('/about');
  }, [navigateIfDifferent]);

  const navigateToSettings = React.useCallback(() => {
    navigateIfDifferent('/settings');
  }, [navigateIfDifferent]);

  const handleBackPress = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigateHome();
  }, [navigateHome, router]);

  const defaultActions = React.useMemo<PageHeaderAction[]>(
    () => [
      { id: PageHeaderActionIds.help, label: 'Help', icon: <IconHelpCircle /> },
      { id: PageHeaderActionIds.about, label: 'About', icon: <IconInfo />, onPress: navigateToAbout },
      { id: PageHeaderActionIds.settings, label: 'Settings', icon: <IconSettings />, onPress: navigateToSettings },
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

  const defaultLogoAccessibilityLabel = `${title} – Go to home`;
  const defaultBackAccessibilityLabel = 'Go back';
  const getLogoAccessibilityLabel = React.useCallback(
    (useBackLabel: boolean) => (logoAccessibilityLabel
      ?? (useBackLabel ? defaultBackAccessibilityLabel : defaultLogoAccessibilityLabel)),
    [defaultBackAccessibilityLabel, defaultLogoAccessibilityLabel, logoAccessibilityLabel],
  );

  const logoContent = (
    <>
      <Image
        source={logoSource}
        style={[styles.logo, isCompact ? styles.logoMobile : undefined]}
        resizeMode="contain"
        accessibilityLabel="WhereWild logo"
      />
      {!isCompact ? (
        <ThemedText
          variant="heading"
          style={{ color: palette.text.brand.default }}
        >
          {title}
        </ThemedText>
      ) : null}
    </>
  );

  const backButtonContent = (
    <IconButton
      variant="subtle"
      size="small"
      icon={<IconChevronLeft />}
      accessibilityLabel={defaultBackAccessibilityLabel}
      onPress={handleBackPress}
    />
  );

  if (isCompact) {
    const useBackContent = isNativeMobile && canNavigateBack;
    const topInset = isNativeMobile ? safeAreaInsets.top : 0;
    return (
      <PageHeaderMobile
        palette={palette}
        logoContent={useBackContent ? backButtonContent : logoContent}
        logoIsButton={useBackContent}
        topInset={topInset}
        style={style}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSubmitSearch={onSubmitSearch}
        searchPlaceholder={searchPlaceholder}
        searchInputProps={searchInputProps}
        actions={resolvedActions}
        showFilterButton={showFilterButton}
        filterButtonDisabled={filterButtonDisabled}
        onFilterPress={onFilterPress}
        filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
        showMenuButton={showMenuButton}
        mobileMenuExpanded={mobileMenuExpanded}
        onMenuPress={handleMenuPress}
        menuAccessibilityLabel={menuAccessibilityLabel}
        onLogoPress={useBackContent ? handleBackPress : navigateHome}
        logoAccessibilityLabel={getLogoAccessibilityLabel(useBackContent)}
      />
    );
  }

  return (
    <PageHeaderDesktop
      palette={palette}
      logoContent={logoContent}
      style={style}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      onSubmitSearch={onSubmitSearch}
      searchPlaceholder={searchPlaceholder}
      searchInputProps={searchInputProps}
      actions={resolvedActions}
      showFilterButton={showFilterButton}
      filterButtonDisabled={filterButtonDisabled}
      onFilterPress={onFilterPress}
      filterLabel={filterLabel}
      filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
      onLogoPress={navigateHome}
      logoAccessibilityLabel={getLogoAccessibilityLabel(false)}
    />
  );
}
