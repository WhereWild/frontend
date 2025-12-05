import { IconFilter, IconMenu } from '@/assets/icons';
import { Size } from '@/constants/theme';
import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Button } from '../buttons/Button';
import { IconButton } from '../buttons/IconButton';
import { SearchInput } from '../inputs/SearchInput';
import { pageHeaderStyles as styles } from './PageHeader.styles';
import type {
  ColorPalette,
  PageHeaderAction,
  SearchInputPassthroughProps,
} from './PageHeader.types';

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
  filterButtonDisabled?: boolean;
  showMenuButton: boolean;
  mobileMenuExpanded: boolean;
  onMenuPress?: () => void;
  menuAccessibilityLabel: string;
  onLogoPress: () => void;
  logoAccessibilityLabel: string;
  logoIsButton?: boolean;
  onDismissMenu?: () => void;
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
  filterButtonDisabled = false,
  showMenuButton,
  mobileMenuExpanded,
  onMenuPress,
  menuAccessibilityLabel,
  onLogoPress,
  logoAccessibilityLabel,
  logoIsButton = false,
  onDismissMenu,
}: PageHeaderMobileProps) {
  const [toolbarHeight, setToolbarHeight] = React.useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const shouldRenderActions = (!showMenuButton || mobileMenuExpanded) && actions.length > 0;

  const handleToolbarLayout = React.useCallback((event: LayoutChangeEvent) => {
    setToolbarHeight(event.nativeEvent.layout.height);
  }, []);

  const handleActionPress = React.useCallback(
    (actionOnPress?: () => void) => () => {
      actionOnPress?.();
      onDismissMenu?.();
    },
    [onDismissMenu],
  );

  const mobileFilterButton = showFilterButton ? (
    <IconButton
      variant="neutral"
      icon={<IconFilter />}
      accessibilityLabel={filterButtonAccessibilityLabel}
      onPress={onFilterPress}
      disabled={filterButtonDisabled}
    />
  ) : null;

  const mobileMenuButton = showMenuButton ? (
    <IconButton
      variant="primary"
      icon={<IconMenu />}
      accessibilityLabel={menuAccessibilityLabel}
      accessibilityState={{ expanded: mobileMenuExpanded }}
      onPress={onMenuPress}
    />
  ) : null;

  const renderedActions = actions.map(({ label, icon, onPress, variant = 'subtle', disabled }) => (
    <View
      key={label}
      style={styles.mobileActionButtonWrapper}
    >
      <Button
        variant={variant}
        onPress={handleActionPress(onPress)}
        iconStart={icon}
        label={label}
        disabled={disabled}
        accessibilityLabel={label}
        style={styles.mobileActionButton}
      />
    </View>
  ));

  const shouldShowScrim = showMenuButton && mobileMenuExpanded;
  const scrimStyle = React.useMemo(
    () => [
      styles.mobileMenuScrim,
      {
        height: windowHeight + toolbarHeight,
        top: -toolbarHeight,
      },
    ],
    [toolbarHeight, windowHeight],
  );

  const logoWrapperStyle = [styles.logoSection, styles.mobileLogoSection];

  const logoNode = logoIsButton ? (
    <View style={logoWrapperStyle}>{logoContent}</View>
  ) : (
    <Pressable
      onPress={onLogoPress}
      style={logoWrapperStyle}
      accessibilityRole="link"
      accessibilityLabel={logoAccessibilityLabel}
    >
      {logoContent}
    </Pressable>
  );

  return (
    <View
      style={[
        styles.mobileContainer,
        shouldRenderActions ? styles.mobileContainerRaised : undefined,
        { backgroundColor: palette.background.default.secondary },
        style,
      ]}
      accessibilityRole="header"
      testID="page-header-mobile-container"
    >
      <View
        style={[
          styles.mobileToolbar,
          { backgroundColor: palette.background.default.secondary },
        ]}
        onLayout={handleToolbarLayout}
        testID="page-header-mobile-toolbar"
      >
        {logoNode}

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
        <>
          {shouldShowScrim ? (
            <Pressable
              style={scrimStyle}
              accessibilityLabel="Dismiss menu"
              accessibilityRole="button"
              onPress={onDismissMenu}
              testID="page-header-mobile-scrim"
            />
          ) : null}
          <View
            style={[
              styles.mobileActionsCard,
              {
                backgroundColor: palette.background.default.tertiary,
                top: toolbarHeight + Size.space['200'],
                right: Size.space['200'],
                borderColor: palette.border.default.tertiary,
                borderWidth: Size.stroke.border,
              },
            ]}
            testID="page-header-mobile-actions-card"
          >
            {renderedActions}
          </View>
        </>
      ) : null}
    </View>
  );
}
