import type { ButtonProps } from '../../buttons/Button';
import type { SearchInputProps } from '../../inputs/SearchInput';

export type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

export type WebPageHeaderAction = {
  label: string;
  icon: ButtonProps['iconStart'];
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
};
