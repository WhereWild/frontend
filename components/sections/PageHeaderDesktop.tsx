import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { IconFilter } from '@/assets/icons';
import type {
  ColorPalette,
  PageHeaderAction,
  SearchInputPassthroughProps,
} from './PageHeader.types';
import { pageHeaderStyles as styles } from './PageHeader.styles';
import { Button } from '../buttons/Button';
import { SearchInput } from '../inputs/SearchInput';

export type PageHeaderDesktopProps = {
  palette: ColorPalette;
  logoContent: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSubmitSearch?: (value: string) => void;
  searchPlaceholder: string;
  searchInputProps?: SearchInputPassthroughProps;
  actions: PageHeaderAction[];
  showFilterButton: boolean;
  onFilterPress?: () => void;
  filterLabel: string;
  filterButtonAccessibilityLabel: string;
  filterButtonDisabled?: boolean;
  onLogoPress: () => void;
  logoAccessibilityLabel: string;
};

export function PageHeaderDesktop({
  palette,
  logoContent,
  style,
  searchValue,
  onSearchChange,
  onSubmitSearch,
  searchPlaceholder,
  searchInputProps,
  actions,
  showFilterButton,
  onFilterPress,
  filterLabel,
  filterButtonAccessibilityLabel,
  filterButtonDisabled = false,
  onLogoPress,
  logoAccessibilityLabel,
}: PageHeaderDesktopProps) {
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
      <Pressable
        onPress={onLogoPress}
        style={styles.logoSection}
        accessibilityRole="link"
        accessibilityLabel={logoAccessibilityLabel}
      >
        {logoContent}
      </Pressable>

      <View style={[styles.searchRow, styles.searchRowDesktop]}>
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
            disabled={filterButtonDisabled}
            accessibilityLabel={filterButtonAccessibilityLabel}
          />
        ) : null}
      </View>

      <View style={styles.actionsWrapper}>
        {actions.map(({ label, icon, onPress, variant = 'subtle', disabled }) => (
          <Button
            key={label}
            variant={variant}
            onPress={onPress}
            iconStart={icon}
            label={label}
            size="medium"
            disabled={disabled}
            accessibilityLabel={label}
          />
        ))}
      </View>
    </View>
  );
}
