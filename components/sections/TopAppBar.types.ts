import type {
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { ReactElement } from 'react';
import type { IconSize } from '@/primitives';

/**
 * Icon component type used for action buttons in the top app bar.
 *
 * The `color` and `size` props are provided so that the TopAppBar implementation
 * can control these visual attributes when rendering, rather than the icon
 * hardcoding them. Consumers should pass an icon component that accepts these
 * optional props and defers their values to the parent.
 */
type TopAppBarActionIcon = ReactElement<{ color?: string; size?: IconSize }>;

export type TopAppBarVariant = 'home' | 'page' | 'search';

export type TopAppBarPrimaryActionMode = 'responsive' | 'icon' | 'button';

export type TopAppBarSecondaryActionConfig = {
  isVisible?: boolean;
  icon?: TopAppBarActionIcon;
  accessibilityLabel?: string;
  onPress?: () => void;
};

export type TopAppBarPrimaryActionConfig = {
  isVisible?: boolean;
  mode?: TopAppBarPrimaryActionMode;
  icon?: TopAppBarActionIcon;
  buttonLabel?: string;
  buttonAccessibilityLabel?: string;
  iconAccessibilityLabel?: string;
  onPress?: () => void;
};

type TopAppBarBaseProps = {
  secondaryAction?: TopAppBarSecondaryActionConfig;
  primaryAction?: TopAppBarPrimaryActionConfig;
  style?: StyleProp<ViewStyle>;
};

export type TopAppBarSearchVariantProps = TopAppBarBaseProps & {
  variant: 'search';
  title?: never;
  logoSource?: never;
  logoAccessibilityLabel?: never;
  onPressLogo?: never;
  onPressBack?: never;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: (value: string) => void;
  searchPlaceholder?: string;
};

export type TopAppBarPageVariantProps = TopAppBarBaseProps & {
  variant: 'page';
  title: string;
  logoSource?: never;
  logoAccessibilityLabel?: never;
  onPressLogo?: never;
  onPressBack: () => void;
  searchValue?: never;
  onSearchValueChange?: never;
  onSubmitSearch?: never;
  searchPlaceholder?: never;
};

export type TopAppBarHomeVariantProps = TopAppBarBaseProps & {
  variant?: 'home';
  title: string;
  logoSource: ImageSourcePropType;
  logoAccessibilityLabel: string;
  onPressLogo?: () => void;
  onPressBack?: never;
  searchValue?: never;
  onSearchValueChange?: never;
  onSubmitSearch?: never;
  searchPlaceholder?: never;
};

export type TopAppBarProps =
  | TopAppBarSearchVariantProps
  | TopAppBarPageVariantProps
  | TopAppBarHomeVariantProps;

type LeadingContentSearchProps = {
  variant: 'search';
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: (value: string) => void;
  searchPlaceholder?: string;
};

type LeadingContentPageProps = {
  variant: 'page';
  title: string;
  onPressBack: () => void;
};

type LeadingContentHomeProps = {
  variant: 'home';
  title: string;
  logoSource: ImageSourcePropType;
  logoAccessibilityLabel: string;
  onPressLogo?: () => void;
};

export type LeadingContentProps =
  | LeadingContentSearchProps
  | LeadingContentPageProps
  | LeadingContentHomeProps;

export type PrimaryActionProps = {
  hasPrimaryButton: boolean;
  shouldRenderPrimaryAsIcon: boolean;
  primaryButtonIcon: TopAppBarActionIcon;
  onPressPrimaryButton?: () => void;
  primaryIconButtonAccessibilityLabel: string;
  primaryButtonAccessibilityLabel: string;
  primaryButtonLabel: string;
};
