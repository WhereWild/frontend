// Compile-time contract checks for TopAppBar variant props.
// This file is validated by `tsc --noEmit` and is not executed at runtime.
// The @ts-expect-error cases ensure invalid variant/prop combinations remain disallowed.
import type { TopAppBarProps } from './TopAppBar';

const validHome: TopAppBarProps = {
  variant: 'home',
  title: 'Home',
};

const validPage: TopAppBarProps = {
  variant: 'page',
  title: 'Details',
  onPressBack: () => {},
};

const validSearch: TopAppBarProps = {
  variant: 'search',
  searchValue: 'lynx',
  onSearchValueChange: () => {},
  onSubmitSearch: () => {},
};

const validHomeWithActions: TopAppBarProps = {
  variant: 'home',
  title: 'Home',
  secondaryAction: {
    isVisible: true,
    accessibilityLabel: 'Reset filters',
    onPress: () => {},
  },
  primaryAction: {
    isVisible: true,
    mode: 'icon',
    buttonLabel: 'Filter',
    buttonAccessibilityLabel: 'Filter',
    iconAccessibilityLabel: 'Filter action',
    onPress: () => {},
  },
};

const validSearchWithButtonPrimary: TopAppBarProps = {
  variant: 'search',
  searchValue: 'lynx',
  onSearchValueChange: () => {},
  onSubmitSearch: () => {},
  primaryAction: {
    mode: 'button',
    buttonLabel: 'Filter',
    onPress: () => {},
  },
};

// @ts-expect-error page variant requires onPressBack
const invalidPageMissingBack: TopAppBarProps = {
  variant: 'page',
};

// @ts-expect-error home variant disallows search props
const invalidHomeWithSearchProps: TopAppBarProps = {
  variant: 'home',
  searchValue: 'lynx',
  onSearchValueChange: () => {},
  onSubmitSearch: () => {},
};

// @ts-expect-error search variant disallows onPressBack
const invalidSearchWithBack: TopAppBarProps = {
  variant: 'search',
  searchValue: 'lynx',
  onSearchValueChange: () => {},
  onSubmitSearch: () => {},
  onPressBack: () => {},
};

// @ts-expect-error page variant disallows logo props
const invalidPageWithLogoProps: TopAppBarProps = {
  variant: 'page',
  title: 'Details',
  onPressBack: () => {},
  logoAccessibilityLabel: 'Logo',
};

// @ts-expect-error search variant requires search handlers
const invalidSearchMissingHandlers: TopAppBarProps = {
  variant: 'search',
  searchValue: 'lynx',
};

const invalidPrimaryMode: TopAppBarProps = {
  variant: 'home',
  title: 'Home',
  primaryAction: {
    // @ts-expect-error mode only accepts responsive, icon, or button
    mode: 'invalid-mode',
  },
};

void validHome;
void validPage;
void validSearch;
void validHomeWithActions;
void validSearchWithButtonPrimary;
void invalidPageMissingBack;
void invalidHomeWithSearchProps;
void invalidSearchWithBack;
void invalidPageWithLogoProps;
void invalidSearchMissingHandlers;
void invalidPrimaryMode;
