import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TopAppBar } from '../TopAppBar';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;

describe('TopAppBar', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<typeof useResponsive>);
  });

  it('renders home variant by default with title and actions', () => {
    render(<TopAppBar />);

    expect(screen.getByText('Page Title')).toBeTruthy();
    expect(screen.getByLabelText('Refresh')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
    expect(screen.queryByLabelText('Search input')).toBeNull();
  });

  it('renders page variant and calls back action', () => {
    const onPressBack = jest.fn();
    render(<TopAppBar variant="page" title="Species" onPressBack={onPressBack} />);

    expect(screen.getByText('Species')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onPressBack).toHaveBeenCalledTimes(1);
  });

  it('renders search variant and forwards search events', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    render(
      <TopAppBar
        variant="search"
        searchValue=""
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />,
    );

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'lynx');
    expect(onSearchValueChange).toHaveBeenCalledWith('lynx');

    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'lynx' } });
    expect(onSubmitSearch).toHaveBeenCalledWith('lynx');
  });

  it('hides secondary button when hasSecondaryButton is false', () => {
    render(<TopAppBar hasSecondaryButton={false} />);

    expect(screen.queryByLabelText('Refresh')).toBeNull();
  });

  it('renders primary button as icon when explicitly configured', () => {
    render(<TopAppBar isPrimaryButtonIcon={true} />);

    expect(screen.getByLabelText('Filter action')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
  });

  it('hides primary button when hasPrimaryButton is false', () => {
    render(<TopAppBar hasPrimaryButton={false} />);

    expect(screen.queryByLabelText('Filter')).toBeNull();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('disables secondary button when handler is missing', () => {
    render(<TopAppBar onPressSecondaryButton={undefined} />);

    expect(screen.getByLabelText('Refresh')).toBeDisabled();
  });

  it('disables primary action when handler is missing', () => {
    render(<TopAppBar onPressPrimaryButton={undefined} />);

    expect(screen.getByLabelText('Filter')).toBeDisabled();
  });

  it('disables icon primary action when handler is missing on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar onPressPrimaryButton={undefined} />);

    expect(screen.getByLabelText('Filter action')).toBeDisabled();
  });

  it('uses one filter handler for text and icon modes', () => {
    const onPressPrimaryButton = jest.fn();

    const { rerender } = render(
      <TopAppBar
        onPressPrimaryButton={onPressPrimaryButton}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter'));

    rerender(
      <TopAppBar
        isPrimaryButtonIcon={true}
        onPressPrimaryButton={onPressPrimaryButton}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter action'));
    expect(onPressPrimaryButton).toHaveBeenCalledTimes(2);
  });

  it('renders primary icon button on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar />);

    expect(screen.getByLabelText('Filter action')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
  });

  it('renders primary text button on tablet breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar />);

    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('renders primary text button on desktop breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar />);

    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('always applies safe-area top inset', () => {
    const insets = { top: 24, bottom: 0, left: 0, right: 0 };

    render(
      <SafeAreaInsetsContext.Provider value={insets}>
        <TopAppBar />
      </SafeAreaInsetsContext.Provider>,
    );

    const withInsetStyles = StyleSheet.flatten(screen.getByTestId('top-app-bar-safe-area').props.style);
    expect(withInsetStyles.paddingTop).toBe(24);
  });

  it('fails safe for invalid search variant runtime props', () => {
    render(<TopAppBar {...({ variant: 'search' } as any)} />);

    const searchInput = screen.getByLabelText('Search input');
    expect(searchInput).toBeTruthy();
    expect(() => fireEvent.changeText(searchInput, 'lynx')).not.toThrow();
    expect(() => fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'lynx' } })).not.toThrow();
  });

  it('fails safe for invalid page variant runtime props', () => {
    render(<TopAppBar {...({ variant: 'page', title: 'Species' } as any)} />);

    const backButton = screen.getByLabelText('Back');
    expect(backButton).toBeTruthy();
    expect(() => fireEvent.press(backButton)).not.toThrow();
  });
});
