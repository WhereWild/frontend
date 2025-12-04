import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { IconFilter, IconMenu } from '@/assets/icons';
import type {
  ColorPalette,
  PageHeaderAction,
  SearchInputPassthroughProps,
} from './PageHeader.types';
import { pageHeaderStyles as styles } from './PageHeader.styles';
import { Button } from '../buttons/Button';
import { IconButton } from '../buttons/IconButton';
import { SearchInput } from '../inputs/SearchInput';
import { Size } from '@/constants/theme';

export type PageHeaderMobileProps = {
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
  filterButtonAccessibilityLabel: string;
  showMenuButton: boolean;
  mobileMenuExpanded: boolean;
  onMenuPress?: () => void;
  menuAccessibilityLabel: string;
  onLogoPress: () => void;
  logoAccessibilityLabel: string;
};

export function PageHeaderMobile({
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
  filterButtonAccessibilityLabel,
  showMenuButton,
  mobileMenuExpanded,
  onMenuPress,
  menuAccessibilityLabel,
  onLogoPress,
  logoAccessibilityLabel,
}: PageHeaderMobileProps) {
  const [toolbarHeight, setToolbarHeight] = React.useState(0);
  const [maxActionWidth, setMaxActionWidth] = React.useState(0);
  const actionSignature = React.useMemo(
    () => actions.map(({ label }) => label).join('|'),
    [actions],
  );
  const shouldRenderActions = (!showMenuButton || mobileMenuExpanded) && actions.length > 0;

  const handleToolbarLayout = React.useCallback((event: LayoutChangeEvent) => {
    setToolbarHeight(event.nativeEvent.layout.height);
  }, []);

  const handleActionLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setMaxActionWidth((prev) => (width > prev ? width : prev));
  }, []);

  React.useEffect(() => {
    setMaxActionWidth(0);
  }, [actionSignature]);

  const mobileFilterButton = showFilterButton ? (
    <IconButton
      variant="neutral"
      size="small"
      icon={<IconFilter />}
      accessibilityLabel={filterButtonAccessibilityLabel}
      onPress={onFilterPress}
    />
  ) : null;

  const mobileMenuButton = showMenuButton ? (
    <IconButton
      variant="primary"
      size="small"
      icon={<IconMenu />}
      accessibilityLabel={menuAccessibilityLabel}
      accessibilityState={{ expanded: mobileMenuExpanded }}
      onPress={onMenuPress}
    />
  ) : null;

  const renderedActions = actions.map(({ label, icon, onPress, variant = 'subtle' }) => (
    <View
      key={label}
      style={[
        styles.mobileActionButtonWrapper,
        maxActionWidth > 0 ? { width: maxActionWidth } : undefined,
      ]}
      onLayout={handleActionLayout}
      testID="page-header-mobile-action-wrapper"
    >
      <Button
        variant={variant}
        onPress={onPress}
        iconStart={icon}
        label={label}
        size="small"
        accessibilityLabel={label}
        style={styles.mobileActionButton}
      />
    </View>
  ));

  return (
    <View
      style={[
        styles.mobileContainer,
        shouldRenderActions ? styles.mobileContainerRaised : undefined,
        style,
      ]}
      accessibilityRole="header"
    >
      <View
        style={[
          styles.mobileToolbar,
          { backgroundColor: palette.background.default.secondary },
        ]}
        onLayout={handleToolbarLayout}
        testID="page-header-mobile-toolbar"
      >
        <Pressable
          onPress={onLogoPress}
          style={[styles.logoSection, styles.mobileLogoSection]}
          accessibilityRole="link"
          accessibilityLabel={logoAccessibilityLabel}
        >
          {logoContent}
        </Pressable>

        <View style={[styles.searchRow, styles.mobileSearchRow]}>
          <View style={styles.searchWrapper}>
            <SearchInput
              value={searchValue}
              onQueryChange={onSearchChange}
              onSubmitSearch={onSubmitSearch}
              placeholder={searchPlaceholder}
              {...searchInputProps}
            />
          </View>
          {mobileFilterButton}
          {mobileMenuButton}
        </View>
      </View>

      {shouldRenderActions ? (
        <View
          style={[
            styles.mobileActionsCard,
            {
              backgroundColor: palette.background.default.tertiary,
              top: toolbarHeight + Size.space['200'],
              right: Size.space['200'],
              borderColor: palette.border.default.tertiary,
              borderWidth: Size.stroke.border,
              shadowColor: palette.text.default.default,
              width: maxActionWidth > 0 ? maxActionWidth + Size.space['400'] : undefined,
            },
          ]}
          testID="page-header-mobile-actions-card"
        >
          {renderedActions}
        </View>
      ) : null}
    </View>
  );
}
