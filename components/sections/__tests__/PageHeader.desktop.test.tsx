import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconHelpCircle } from '@/assets/icons';
import { PageHeader } from '../PageHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    width: 1024,
    height: 768,
    scale: 1,
    fontScale: 1,
  }),
}));

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

describe('PageHeader (desktop)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
  });

  const defaultLogoAccessibilityLabel = 'WhereWild – Go to home';

  it('renders title, search input, and default actions', () => {
    render(<PageHeader searchValue="lynx" />);

    expect(screen.getByText('WhereWild')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search').props.value).toBe('lynx');
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();
  });

  it('navigates to about when default About action is pressed', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).toHaveBeenCalledWith('/about');
  });

  it('does not navigate when already on About', () => {
    mockPathname = '/about';
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes custom action handler when pressed', () => {
    const handlePress = jest.fn();
    render(
      <PageHeader
        actions={[{ label: 'Docs', icon: <IconHelpCircle />, onPress: handlePress }]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Docs'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('navigates home when logo is pressed from another page', () => {
    mockPathname = '/about';
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText(defaultLogoAccessibilityLabel));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not navigate home when already on the root path', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText(defaultLogoAccessibilityLabel));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes filter handler when filter button is pressed', () => {
    const handleFilter = jest.fn();
    render(<PageHeader onFilterPress={handleFilter} />);

    fireEvent.press(screen.getByLabelText('Filter search results'));
    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('can hide the filter button', () => {
    render(<PageHeader showFilterButton={false} />);

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
  });
});
