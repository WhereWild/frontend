import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PageHeader } from '../PageHeader';
import { IconHelpCircle } from '@/assets/icons';

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

describe('PageHeader', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
  });

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

  it('invokes action handler when pressed', () => {
    const handlePress = jest.fn();
    render(
      <PageHeader
        actions={[{ label: 'Docs', icon: <IconHelpCircle />, onPress: handlePress }]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Docs'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('calls onLogoPress when the logo is pressed', () => {
    const handleLogoPress = jest.fn();
    render(
      <PageHeader
        onLogoPress={handleLogoPress}
        logoAccessibilityLabel="Go home"
      />,
    );

    fireEvent.press(screen.getByLabelText('Go home'));
    expect(handleLogoPress).toHaveBeenCalledTimes(1);
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
