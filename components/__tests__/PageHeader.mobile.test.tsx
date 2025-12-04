import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IconHelpCircle } from '@/assets/icons';
import { Size } from '@/constants/theme';
import { PageHeader } from '../sections/PageHeader';

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
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
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
    mockPathname = '/';
  });

  it('renders filter and menu icon buttons while hiding actions initially', () => {
    render(<PageHeader />);

    const filterButton = screen.getByLabelText('Filter search results');
    const menuButton = screen.getByLabelText('Toggle navigation menu');

    expect(filterButton).toBeTruthy();
    expect(menuButton).toBeTruthy();
    expect(screen.queryByLabelText('Help')).toBeNull();
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
      const dynamicStyles = selectStyleObject(actionsCard.props.style, style => 'top' in style);
      expect(dynamicStyles?.top).toBe(72 + Size.space['200']);
    });
  });

  it('equalizes action widths based on measured layouts', async () => {
    render(<PageHeader showMenuButton={false} />);

    const actionWrappers = screen.getAllByTestId('page-header-mobile-action-wrapper');
    fireEvent(actionWrappers[0], 'layout', {
      nativeEvent: { layout: { width: 80, height: 24, x: 0, y: 0 } },
    });
    fireEvent(actionWrappers[1], 'layout', {
      nativeEvent: { layout: { width: 120, height: 24, x: 0, y: 0 } },
    });

    await waitFor(() => {
      const updatedWrappers = screen.getAllByTestId('page-header-mobile-action-wrapper');
      const firstStyles = selectStyleObject(updatedWrappers[0].props.style, style => 'width' in style);
      const secondStyles = selectStyleObject(updatedWrappers[1].props.style, style => 'width' in style);
      expect(firstStyles?.width).toBe(120);
      expect(secondStyles?.width).toBe(120);
    });

    fireEvent(actionWrappers[0], 'layout', {
      nativeEvent: { layout: { width: 60, height: 24, x: 0, y: 0 } },
    });

    await waitFor(() => {
      const updatedWrappers = screen.getAllByTestId('page-header-mobile-action-wrapper');
      const dynamicStyles = selectStyleObject(updatedWrappers[0].props.style, style => 'width' in style);
      expect(dynamicStyles?.width).toBe(120);
    });

    const actionsCard = screen.getByTestId('page-header-mobile-actions-card');
    const cardStyles = selectStyleObject(actionsCard.props.style, style => 'width' in style);
    expect(cardStyles?.width).toBe(120 + Size.space['400']);
  });

  it('resets action width measurements when the actions array changes', async () => {
    const initialActions = [
      { label: 'Alpha', icon: <IconHelpCircle /> },
      { label: 'Beta', icon: <IconHelpCircle /> },
    ];
    const { rerender } = render(
      <PageHeader showMenuButton={false} actions={initialActions} />,
    );

    const initialWrappers = screen.getAllByTestId('page-header-mobile-action-wrapper');
    fireEvent(initialWrappers[0], 'layout', {
      nativeEvent: { layout: { width: 90, height: 24, x: 0, y: 0 } },
    });
    await waitFor(() => {
      const wrappers = screen.getAllByTestId('page-header-mobile-action-wrapper');
      const dynamicStyles = selectStyleObject(wrappers[0].props.style, style => 'width' in style);
      expect(dynamicStyles?.width).toBe(90);
    });

    rerender(
      <PageHeader showMenuButton={false} actions={[{ label: 'Gamma', icon: <IconHelpCircle /> }]} />,
    );

    await waitFor(() => {
      const [wrapper] = screen.getAllByTestId('page-header-mobile-action-wrapper');
      const styles = selectStyleObject(wrapper.props.style, style => 'width' in style);
      expect(styles).toBeUndefined();
    });

    const [wrapper] = screen.getAllByTestId('page-header-mobile-action-wrapper');
    fireEvent(wrapper, 'layout', {
      nativeEvent: { layout: { width: 60, height: 24, x: 0, y: 0 } },
    });

    await waitFor(() => {
      const [updatedWrapper] = screen.getAllByTestId('page-header-mobile-action-wrapper');
      const dynamicStyles = selectStyleObject(updatedWrapper.props.style, style => 'width' in style);
      expect(dynamicStyles?.width).toBe(60);
    });
  });
});
