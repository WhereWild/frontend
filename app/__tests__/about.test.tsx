import { Colors, Shadows, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import About from '../about';

const mockPush = jest.fn();
let mockPathname: '/' | '/about' = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ breakpoint: 'desktop' }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const TYPOGRAPHY_SAMPLE_TEXT = 'Sphinx of black quartz, judge my vow.';
const EXPECTED_TYPOGRAPHY_LABELS = [
  'Title Hero',
  'Title Page',
  'Subtitle',
  'Heading',
  'Subheading',
  'Body',
  'Body Emphasis',
  'Body Strong',
  'Body Small',
  'Body Small Emphasis',
  'Body Small Strong',
  'Body Tiny',
  'Body Tiny Strong',
  'Link',
  'Code',
  'Single Line Body',
  'Single Line Body Small',
  'Single Line Body Small Strong',
  'Single Line Body Tiny',
  'Single Line Body Tiny Strong',
] as const;

describe('About screen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
  });

  it('renders the species component preview with sample data', () => {
    render(<About />);

    expect(screen.getByText('Species Page Components')).toBeTruthy();
    expect(
      screen.getByText('Preview of the composable building blocks used on the species detail page.'),
    ).toBeTruthy();
    expect(screen.getByText('Mountain Ball Cactus')).toBeTruthy();
    expect(screen.getByText('Pediocactus simpsonii')).toBeTruthy();
    expect(screen.getByText('Nearby Species')).toBeTruthy();
  });

  it('updates the playground search status text when typing and clearing', () => {
    render(<About />);

    const speciesSearchInput = screen.getAllByLabelText('Search species')[0];
    fireEvent.changeText(speciesSearchInput, 'pinyon');
    expect(screen.getByText('Query changed: pinyon')).toBeTruthy();

    const clearSpeciesSearch = screen.getByLabelText('Clear search');
    fireEvent.press(clearSpeciesSearch);
    expect(screen.getByText('Search cleared')).toBeTruthy();
  });

  it('records submission events for the playground search input', () => {
    render(<About />);

    const speciesSearchInput = screen.getAllByLabelText('Search species')[0];
    fireEvent.changeText(speciesSearchInput, 'sage');
    fireEvent(speciesSearchInput, 'submitEditing', { nativeEvent: { text: 'sage' } });

    expect(screen.getByText('Search submitted with "sage"')).toBeTruthy();
  });

  it('renders previews for each typography variant and shadow token', () => {
    render(<About />);

    const typographyVariantCount = Object.keys(Typography.light).length;
    expect(EXPECTED_TYPOGRAPHY_LABELS).toHaveLength(typographyVariantCount);
    const typographySamples = screen.getAllByTestId('typography-sample');
    expect(typographySamples).toHaveLength(typographyVariantCount);
    typographySamples.forEach((sample, index) => {
      const scoped = within(sample);
      expect(scoped.getByText(EXPECTED_TYPOGRAPHY_LABELS[index])).toBeTruthy();
      expect(scoped.getByText(TYPOGRAPHY_SAMPLE_TEXT)).toBeTruthy();
    });
    expect(screen.getAllByTestId('shadow-sample')).toHaveLength(Object.keys(Shadows).length);
  });

  it('does not push a new route when already viewing About', () => {
    mockPathname = '/about';
    render(<About />);

    fireEvent.press(screen.getByLabelText('About'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');
    const tree = render(<About />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected About to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });
});
