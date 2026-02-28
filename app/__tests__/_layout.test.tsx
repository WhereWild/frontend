import React from 'react';
import { View } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import RootLayout from '../_layout';
import { useFonts } from 'expo-font';
import { usePathname, useRouter } from 'expo-router';
import { Time } from '@/constants/theme';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

const recordedStackProps: any[] = [];

function mockStack(props: any) {
  recordedStackProps.push(props);
  return <View testID="app-stack" />;
}

jest.mock('expo-router', () => ({
  Stack: mockStack,
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockNavigationBar = jest.fn((_props?: unknown) => <View testID="mock-navigation-bar" />);

jest.mock('@/components', () => ({
  NavigationBar: (props: unknown) => mockNavigationBar(props),
}));

type NavTab = {
  key: string;
  state?: 'default' | 'active' | 'pressed';
  onPress?: () => void;
};

const getRenderedTabs = (): NavTab[] => {
  const lastCall = mockNavigationBar.mock.calls[mockNavigationBar.mock.calls.length - 1] as
    | unknown[]
    | undefined;
  if (!lastCall) {
    return [];
  }

  const props = lastCall[0] as { tabs?: NavTab[] } | undefined;
  if (!props) {
    return [];
  }

  return props.tabs ?? [];
};

const getTabByKey = (key: string): NavTab | undefined =>
  getRenderedTabs().find((tab) => tab.key === key);

describe('Root layout', () => {
  const mockReplace = jest.fn();
  const mockPush = jest.fn();
  const mockDismissAll = jest.fn();
  const mockCanGoBack = jest.fn(() => false);

  const createRouterMock = () => ({
    replace: mockReplace,
    push: mockPush,
    dismissAll: mockDismissAll,
    canGoBack: mockCanGoBack,
  });

  afterEach(() => {
    mockUseFonts.mockReset();
    mockUseRouter.mockReset();
    mockUsePathname.mockReset();
    mockNavigationBar.mockReset();
    mockReplace.mockReset();
    mockPush.mockReset();
    mockDismissAll.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    recordedStackProps.length = 0;
  });

  it('renders nothing until fonts are loaded', () => {
    mockUseFonts.mockReturnValue([false, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('app-stack')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/');

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({
      headerShown: false,
      animation: 'fade',
      animationDuration: Time.duration.short,
    });
  });

  it('keeps the previous top-level tab active on species routes', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    const searchTabBefore = getRenderedTabs().find((tab) => tab.key === 'search');
    expect(searchTabBefore?.state).toBe('active');

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    const searchTabAfter = getRenderedTabs().find((tab) => tab.key === 'search');
    const homeTabAfter = getRenderedTabs().find((tab) => tab.key === 'home');
    expect(searchTabAfter?.state).toBe('active');
    expect(homeTabAfter?.state).toBe('default');
  });

  it('defaults to Home active when first route is not top-level', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/species/123');

    render(<RootLayout />);

    expect(getTabByKey('home')?.state).toBe('active');
    expect(getTabByKey('search')?.state).toBe('default');
    expect(getTabByKey('about')?.state).toBe('default');
    expect(getTabByKey('settings')?.state).toBe('default');
  });

  it('activates About tab on about route', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/about');

    render(<RootLayout />);

    expect(getTabByKey('about')?.state).toBe('active');
    expect(getTabByKey('home')?.state).toBe('default');
    expect(getTabByKey('search')?.state).toBe('default');
    expect(getTabByKey('settings')?.state).toBe('default');
  });

  it('tab presses replace only when target path differs', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/search');

    render(<RootLayout />);

    getTabByKey('search')?.onPress?.();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();

    getTabByKey('home')?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockPush).not.toHaveBeenCalled();

    getTabByKey('about')?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/about');

    getTabByKey('settings')?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('does not re-navigate when pressing inherited active tab on species route', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it('restores each tab to its own latest route history', async () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['123'] },
    });

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    await waitFor(() => {
      expect(getTabByKey('search')?.state).toBe('active');
      expect(getTabByKey('about')?.state).toBe('default');
    });
  });

  it('restores all nested route layers for a tab', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123/photos';
    rerender(<RootLayout />);

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['123'] },
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['123', 'photos'] },
    });
  });

  it('truncates restored tab history when user navigates back within that tab', () => {
    const pathnameState = {
      value: '/search',
    } as { value: string };

    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockImplementation(() => pathnameState.value);

    const { rerender } = render(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123/photos';
    rerender(<RootLayout />);

    pathnameState.value = '/species/123';
    rerender(<RootLayout />);

    pathnameState.value = '/about';
    rerender(<RootLayout />);

    getTabByKey('search')?.onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['123'] },
    });
    expect(mockPush).not.toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['123', 'photos'] },
    });
  });

  it('clears stack on tab switch when back stack exists', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue(createRouterMock() as never);
    mockUsePathname.mockReturnValue('/species/123');
    mockCanGoBack.mockReturnValue(true);

    render(<RootLayout />);

    getTabByKey('about')?.onPress?.();

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/about');
    expect(mockPush).not.toHaveBeenCalled();
  });

});
