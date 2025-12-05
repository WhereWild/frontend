import React from 'react';
import { View } from 'react-native';
import type { PageHeaderProps } from './PageHeader.types';
import { PageHeaderDesktop } from './PageHeaderDesktop';
import { PageHeaderMobile } from './PageHeaderMobile';
import { usePageHeaderController } from './usePageHeaderController';

export type { PageHeaderProps } from './PageHeader.types';
const DEFAULT_LOGO = require('@/assets/images/wherewild.png');

export function PageHeader({
  title = 'WhereWild',
  logoSource = DEFAULT_LOGO,
  logoAccessibilityLabel,
  searchValue,
  onSearchChange,
  onSubmitSearch: onSubmitSearchProp,
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
  showBackButton,
  onBackPress,
}: PageHeaderProps) {
  const {
    palette,
    isCompact,
    mobileMenuExpanded,
    filterButtonDisabled,
    resolvedActions,
    handleSubmitSearch,
    handleBackPress,
    navigateHome,
    getLogoAccessibilityLabel,
    logoContent,
    logoTitleContent,
    backButtonContent,
    insetWrapperStyle,
    showNativeBackButton,
    handleMenuPress,
    dismissMobileMenu,
  } = usePageHeaderController({
    title,
    logoSource,
    logoAccessibilityLabel,
    actions,
    showMenuButton,
    onMenuPress,
    style,
    onSubmitSearchProp,
    showBackButton,
    onBackPress,
  });

  if (isCompact) {
    return (
      <View style={insetWrapperStyle} testID="page-header-safe-area-wrapper">
        <PageHeaderMobile
          palette={palette}
          logoContent={showNativeBackButton ? backButtonContent : logoContent}
          logoIsButton={showNativeBackButton}
          style={style}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onSubmitSearch={handleSubmitSearch}
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
          onDismissMenu={dismissMobileMenu}
          menuAccessibilityLabel={menuAccessibilityLabel}
          onLogoPress={showNativeBackButton ? handleBackPress : navigateHome}
          logoAccessibilityLabel={getLogoAccessibilityLabel(showNativeBackButton)}
        />
      </View>
    );
  }

  return (
    <View style={insetWrapperStyle} testID="page-header-safe-area-wrapper">
      <PageHeaderDesktop
        palette={palette}
        logoContent={logoContent}
        logoTitleContent={logoTitleContent}
        style={style}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSubmitSearch={handleSubmitSearch}
        searchPlaceholder={searchPlaceholder}
        searchInputProps={searchInputProps}
        actions={resolvedActions}
        showFilterButton={showFilterButton}
        onFilterPress={onFilterPress}
        filterLabel={filterLabel}
        filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
        filterButtonDisabled={filterButtonDisabled}
        onLogoPress={navigateHome}
        logoAccessibilityLabel={getLogoAccessibilityLabel(false)}
      />
    </View>
  );
}
