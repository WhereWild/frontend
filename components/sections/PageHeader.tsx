import {
  IconHelpCircle,
  IconInfo,
  IconSettings,
} from '@/assets/icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useIsCompact } from '@/hooks/useResponsive';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Image } from 'react-native';
import { PageHeaderDesktop } from './PageHeaderDesktop';
import { PageHeaderMobile } from './PageHeaderMobile';
import { ThemedText } from '../text/ThemedText';
import type { PageHeaderAction, PageHeaderProps } from './PageHeader.types';
import { pageHeaderStyles as styles } from './PageHeader.styles';
export type { PageHeaderAction, PageHeaderProps } from './PageHeader.types';

const DEFAULT_LOGO = require('@/assets/images/wherewild.png');

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
  const [mobileMenuExpanded, setMobileMenuExpanded] = React.useState(false);

  const navigateIfDifferent = React.useCallback((targetPath: '/' | '/about') => {
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

  const defaultActions = React.useMemo<PageHeaderAction[]>(
    () => [
      { label: 'Help', icon: <IconHelpCircle /> },
      { label: 'About', icon: <IconInfo />, onPress: navigateToAbout },
      { label: 'Settings', icon: <IconSettings /> },
    ],
    [navigateToAbout],
  );

  const resolvedActions = actions ?? defaultActions;

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
  const resolvedLogoAccessibilityLabel = logoAccessibilityLabel ?? defaultLogoAccessibilityLabel;

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

  if (isCompact) {
    return (
      <PageHeaderMobile
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
        onFilterPress={onFilterPress}
        filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
        showMenuButton={showMenuButton}
        mobileMenuExpanded={mobileMenuExpanded}
        onMenuPress={handleMenuPress}
        menuAccessibilityLabel={menuAccessibilityLabel}
        onLogoPress={navigateHome}
        logoAccessibilityLabel={resolvedLogoAccessibilityLabel}
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
      onFilterPress={onFilterPress}
      filterLabel={filterLabel}
      filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
      onLogoPress={navigateHome}
      logoAccessibilityLabel={resolvedLogoAccessibilityLabel}
    />
  );
}
