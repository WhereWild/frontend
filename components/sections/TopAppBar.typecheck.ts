// Compile-time contract checks for TopAppBar variant props.
// This file is validated by `tsc --noEmit` and is not executed at runtime.
// The @ts-expect-error cases ensure invalid variant/prop combinations remain disallowed.
import type { TopAppBarProps } from './TopAppBar';

const validHome: TopAppBarProps = {
  variant: 'home',
  title: 'Home',
  logoSource: require('@/assets/images/wherewild.png'),
  logoAccessibilityLabel: 'WhereWild logo',
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

// @ts-expect-error page variant requires onPressBack
const invalidPageMissingBack: TopAppBarProps = {
  variant: 'page',
};

// @ts-expect-error home variant requires logoSource and logoAccessibilityLabel
const invalidHomeMissingLogoProps: TopAppBarProps = {
  variant: 'home',
  title: 'Home',
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

void validHome;
void validPage;
void validSearch;
void invalidPageMissingBack;
void invalidHomeMissingLogoProps;
void invalidHomeWithSearchProps;
void invalidSearchWithBack;
