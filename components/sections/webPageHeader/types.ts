import type { ButtonProps } from '../../buttons/Button';
import type { SearchInputProps } from '../../inputs/SearchInput';

/** Optional SearchInput props that WebPageHeader allows consumers to pass through. */
export type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

/** Action model for right-side header actions and compact menu items. */
export type WebPageHeaderAction = {
  label: string;
  icon: ButtonProps['iconStart'];
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
};
