import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  IconFilter,
  IconHelpCircle,
  IconInfo,
  IconSettings,
} from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePathname, useRouter } from 'expo-router';
import { SearchInput, type SearchInputProps } from './SearchInput';
import { Button } from './Button';
import { ThemedText } from './ThemedText';

// Allows callers to forward styling/behavior props to SearchInput while keeping PageHeader in control of its value.
type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

export type PageHeaderAction = {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
};

export type PageHeaderProps = {
  title?: string;
  logoSource?: ImageSourcePropType;
  onLogoPress?: () => void;
  logoAccessibilityLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSubmitSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchInputProps?: SearchInputPassthroughProps;
  actions?: PageHeaderAction[];
  showFilterButton?: boolean;
  onFilterPress?: () => void;
  filterLabel?: string;
  filterButtonAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_LOGO = require('@/assets/images/wherewild.png');

export function PageHeader({
  title = 'WhereWild',
  logoSource = DEFAULT_LOGO,
  searchValue = '',
  onSearchChange,
  onSubmitSearch,
  searchPlaceholder = 'Search',
  searchInputProps,
  actions,
  showFilterButton = true,
  onFilterPress,
  filterLabel = 'Filter',
  filterButtonAccessibilityLabel = 'Filter search results',
  style,
  onLogoPress,
  logoAccessibilityLabel = 'Go to home',
}: PageHeaderProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const router = useRouter();
  const pathname = usePathname();
  const navigateToAbout = React.useCallback(() => {
    if (pathname !== '/about') {
      router.push('/about');
    }
  }, [pathname, router]);
  const defaultActions = React.useMemo<PageHeaderAction[]>(
    () => [
      { label: 'Help', icon: <IconHelpCircle /> },
      { label: 'About', icon: <IconInfo />, onPress: navigateToAbout },
      { label: 'Settings', icon: <IconSettings /> },
    ],
    [navigateToAbout],
  );
  const resolvedActions = actions ?? defaultActions;
  const logoContent = (
    <>
      <Image
        source={logoSource}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="WhereWild logo"
      />
      <ThemedText
        variant="heading"
        style={{ color: palette.text.brand.default }}  // override color to match page header mock
      >
        {title}
      </ThemedText>
    </>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.secondary,
        },
        style,
      ]}
      accessibilityRole="header"
    >
      {onLogoPress ? (
        <Pressable
          onPress={onLogoPress}
          style={styles.logoSection}
          accessibilityRole="link"
          accessibilityLabel={logoAccessibilityLabel}
        >
          {logoContent}
        </Pressable>
      ) : (
        <View style={styles.logoSection}>{logoContent}</View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <SearchInput
            value={searchValue}
            onQueryChange={onSearchChange}
            onSubmitSearch={onSubmitSearch}
            placeholder={searchPlaceholder}
            {...searchInputProps}
          />
        </View>
        {showFilterButton ? (
          <Button
            variant="neutral"
            iconStart={<IconFilter />}
            label={filterLabel}
            onPress={onFilterPress}
            accessibilityLabel={filterButtonAccessibilityLabel}
          />
        ) : null}
      </View>

      <View style={styles.actionsWrapper}>
        {resolvedActions.map(({ label, icon, onPress, variant = 'subtle' }) => (
          <Button
            key={label}
            variant={variant}
            onPress={onPress}
            iconStart={icon}
            label={label}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Size.space['800'],
    paddingVertical: Size.space['200'],
    gap: Size.space['400'],
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  logo: {
    width: Size.space['1600'],
    height: Size.space['1600'],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Size.space['400'],
  },
  searchWrapper: {
    flex: 1,
    minWidth: 240,
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
});
