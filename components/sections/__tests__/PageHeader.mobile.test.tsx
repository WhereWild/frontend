import { IconHelpCircle } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { PageHeader } from '../PageHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    width: 360,
    height: 640,
    scale: 1,
    fontScale: 1,
  }),
}));

const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => false);
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, canGoBack: mockCanGoBack }),
  usePathname: () => mockPathname,
}));

const mockInsets: EdgeInsets = { top: 20, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

const selectStyleObject = (
  styleProp: unknown,
  predicate: (style: Record<string, unknown>) => boolean = () => true,
) => {
  if (Array.isArray(styleProp)) {
    return styleProp.find(
      (style): style is Record<string, unknown> =>
        Boolean(style) && typeof style === 'object' && !Array.isArray(style) && predicate(style),
    );
  }

  if (styleProp && typeof styleProp === 'object') {
    const style = styleProp as Record<string, unknown>;
    return predicate(style) ? style : undefined;
  }

  return undefined;
};

describe('PageHeader (mobile)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockCanGoBack.mockReturnValue(false);
    mockPathname = '/';
  });

  it('renders filter and menu icon buttons while hiding actions initially', () => {
    mockCanGoBack.mockReturnValue(true);
    render(<PageHeader />);

    const filterButton = screen.getByLabelText('Filter search results');
    const menuButton = screen.getByLabelText('Toggle navigation menu');
    const backButton = screen.getByLabelText('Go back');

    expect(filterButton).toBeTruthy();
    expect(menuButton).toBeTruthy();
    expect(backButton).toBeTruthy();
    expect(screen.queryByLabelText('Help')).toBeNull();
  });

  it('shows the logo link when the router cannot go back', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<PageHeader />);

    expect(screen.queryByLabelText('Go back')).toBeNull();
    expect(screen.getByLabelText('WhereWild – Go to home')).toBeTruthy();
  });

  it('shows the back button when the current route is not the root even if the router cannot go back', () => {
    mockPathname = '/about';
    mockCanGoBack.mockReturnValue(false);
    render(<PageHeader />);

    expect(screen.getByLabelText('Go back')).toBeTruthy();
    expect(screen.queryByLabelText('WhereWild – Go to home')).toBeNull();
  });

  it('toggles the mobile action menu when the menu button is pressed', () => {
    render(<PageHeader />);

    const menuButton = screen.getByLabelText('Toggle navigation menu');
    fireEvent.press(menuButton);

    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();

    fireEvent.press(menuButton);
    expect(screen.queryByLabelText('Help')).toBeNull();
  });

  it('invokes onMenuPress callback', () => {
    const handleMenuToggle = jest.fn();
    render(<PageHeader onMenuPress={handleMenuToggle} />);

    fireEvent.press(screen.getByLabelText('Toggle navigation menu'));
    expect(handleMenuToggle).toHaveBeenCalled();
  });

  it('dismisses the action list when an action is pressed', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('Toggle navigation menu'));
    fireEvent.press(screen.getByLabelText('Help'));

    expect(screen.queryByLabelText('Help')).toBeNull();
  });

  it('dismisses the action list when tapping outside the menu', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('Toggle navigation menu'));
    fireEvent.press(screen.getByTestId('page-header-mobile-scrim'));

    expect(screen.queryByLabelText('Help')).toBeNull();
  });

  it('shows actions immediately when the menu button is hidden', () => {
    render(<PageHeader showMenuButton={false} />);

    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('hides the filter button when disabled', () => {
    render(<PageHeader showFilterButton={false} />);

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
  });

  it('positions the action card using the measured toolbar height', async () => {
    render(<PageHeader showMenuButton={false} />);

    const toolbar = screen.getByTestId('page-header-mobile-toolbar');
    fireEvent(toolbar, 'layout', {
      nativeEvent: { layout: { width: 300, height: 72, x: 0, y: 0 } },
    });

    await waitFor(() => {
      const actionsCard = screen.getByTestId('page-header-mobile-actions-card');
      const topStyles = selectStyleObject(actionsCard.props.style, style => 'top' in style);
      expect(topStyles?.top).toBe(72 + Size.space['200']);
      const widthStyles = selectStyleObject(actionsCard.props.style, style => 'width' in style);
      expect(widthStyles?.width).toBe(Size.space['4000']);
    });
  });

  it('keeps a fixed token-based width for the action card regardless of actions', () => {
    const initialActions = [
      { label: 'Alpha', icon: <IconHelpCircle /> },
      { label: 'Beta', icon: <IconHelpCircle /> },
    ];
    const { rerender } = render(
      <PageHeader showMenuButton={false} actions={initialActions} />,
    );

    let actionsCard = screen.getByTestId('page-header-mobile-actions-card');
    let widthStyles = selectStyleObject(actionsCard.props.style, style => 'width' in style);
    expect(widthStyles?.width).toBe(Size.space['4000']);

    rerender(
      <PageHeader showMenuButton={false} actions={[{ label: 'Gamma', icon: <IconHelpCircle /> }]} />,
    );

    actionsCard = screen.getByTestId('page-header-mobile-actions-card');
    widthStyles = selectStyleObject(actionsCard.props.style, style => 'width' in style);
    expect(widthStyles?.width).toBe(Size.space['4000']);
  });

  it('applies safe-area padding and header background color via wrapper view', () => {
    render(<PageHeader />);

    const wrapper = screen.getByTestId('page-header-safe-area-wrapper');
    const wrapperStyles = selectStyleObject(wrapper.props.style, style => 'paddingTop' in style);
    expect(wrapperStyles?.paddingTop).toBe(mockInsets.top);
    expect(wrapperStyles?.backgroundColor).toBe(Colors.light.background.default.secondary);
  });
});
