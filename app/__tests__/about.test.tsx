import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import About from '../about';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }),
}));

const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => false);
let mockPathname: '/' | '/about' | '/settings' = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    canGoBack: mockCanGoBack,
  }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

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

    const clearSpeciesSearch = screen.getByTestId('search-input-clear');
    fireEvent.press(clearSpeciesSearch);
    expect(screen.getByText('Search cleared')).toBeTruthy();
  });

  it('submits the header search input through the icon button', () => {
    render(<About />);

    const headerSearchInput = screen.getAllByPlaceholderText('Search')[0];
    fireEvent.changeText(headerSearchInput, 'lichen');
    const headerSearchIcon = screen.getAllByTestId('search-input-icon')[0];
    fireEvent.press(headerSearchIcon);
    expect(screen.getByText('Header search submitted with "lichen"')).toBeTruthy();
  });

  it('records submission events for the playground search input', () => {
    render(<About />);

    const speciesSearchInput = screen.getAllByLabelText('Search species')[0];
    fireEvent.changeText(speciesSearchInput, 'sage');
    fireEvent(speciesSearchInput, 'submitEditing', { nativeEvent: { text: 'sage' } });

    expect(screen.getByText('Search submitted with "sage"')).toBeTruthy();
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
