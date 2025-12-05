import { Colors } from '@/constants/theme';
import type { ReactNode } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { SearchInputProps } from '../inputs/SearchInput';

export type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

export type ColorPalette = typeof Colors.light;

export type PageHeaderAction = {
  id?: string;
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
  disabled?: boolean;
};

export type PageHeaderProps = {
  title?: string;
  logoSource?: ImageSourcePropType;
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
  showMenuButton?: boolean;
  onMenuPress?: () => void;
  menuAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  showBackButton?: boolean;
  onBackPress?: () => void;
};
