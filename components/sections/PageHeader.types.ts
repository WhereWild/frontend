import type { ReactNode } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { SearchInputProps } from '../inputs/SearchInput';
import { Colors } from '@/constants/theme';

export type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

export type ColorPalette = typeof Colors.light;

export type PageHeaderAction = {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
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
};
