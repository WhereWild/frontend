import type {
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type TopAppBarVariant = 'home' | 'page' | 'search';

export type TopAppBarSharedProps = {
  title?: string;
  logoSource?: ImageSourcePropType;
  logoAccessibilityLabel?: string;
  hasSecondaryButton?: boolean;
  hasPrimaryButton?: boolean;
  isPrimaryButtonIcon?: boolean;
  secondaryButtonAccessibilityLabel?: string;
  primaryButtonAccessibilityLabel?: string;
  primaryIconButtonAccessibilityLabel?: string;
  primaryButtonLabel?: string;
  onPressSecondaryButton?: () => void;
  onPressPrimaryButton?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type TopAppBarSearchVariantProps = TopAppBarSharedProps & {
  variant: 'search';
  onPressBack?: never;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: (value: string) => void;
  searchPlaceholder?: string;
};

export type TopAppBarPageVariantProps = TopAppBarSharedProps & {
  variant: 'page';
  onPressBack: () => void;
  searchValue?: never;
  onSearchValueChange?: never;
  onSubmitSearch?: never;
  searchPlaceholder?: never;
};

export type TopAppBarHomeVariantProps = TopAppBarSharedProps & {
  variant?: 'home';
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

type LeadingContentSharedProps = {
  title: string;
  logoSource: ImageSourcePropType;
  logoAccessibilityLabel: string;
};

export type LeadingContentProps =
  | (LeadingContentSharedProps & Pick<TopAppBarSearchVariantProps,
    'variant' | 'searchValue' | 'onSearchValueChange' | 'onSubmitSearch' | 'searchPlaceholder'
  >)
  | (LeadingContentSharedProps & Pick<TopAppBarPageVariantProps, 'variant' | 'onPressBack'>)
  | (LeadingContentSharedProps & { variant: 'home' });

export type PrimaryActionProps = {
  hasPrimaryButton: boolean;
  shouldRenderPrimaryAsIcon: boolean;
  onPressPrimaryButton?: () => void;
  primaryIconButtonAccessibilityLabel: string;
  primaryButtonAccessibilityLabel: string;
  primaryButtonLabel: string;
};
