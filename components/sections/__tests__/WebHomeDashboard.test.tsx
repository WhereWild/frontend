import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { WebHomeDashboard } from '../WebHomeDashboard';
import { useHomeDashboardState } from '@/hooks/useHomeDashboardState';
import { fetchSpeciesWithModels } from '@/data/api';

const mockUseResponsive = jest.fn(() => ({
  breakpoint: 'desktop',
  contentWidth: 720,
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => undefined),
  getResponsiveGapStyle: jest.fn(() => undefined),
}));

jest.mock('@/hooks/useHomeDashboardState', () => ({
  useHomeDashboardState: jest.fn(),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesWithModels: jest.fn(() => Promise.resolve([])),
  fetchViewportScores: jest.fn(() =>
    Promise.resolve({ scores: {}, reasons: {} }),
  ),
  BACKEND_BASE: 'https://api.test',
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');

  return {
    ActiveNearYouSection: ({
      style,
    }: {
      style?: React.ComponentProps<typeof View>['style'];
    }) => <View testID='active-near-you-section' style={style} />,
    HomeRecommendationFilter: () => (
      <View testID='home-recommendation-filter' />
    ),
    LocalMapSection: () => <View testID='local-map-section' />,
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
    PageTitle: ({
      title,
      button,
      iconButton,
    }: {
      title: string;
      button?: {
        label?: string;
        onPress?: () => void;
        variant?: string;
        enableHaptics?: boolean;
      };
      iconButton?: {
        accessibilityLabel?: string;
        onPress?: () => void;
        enableHaptics?: boolean;
      };
    }) => (
      <View>
        <Text>{title}</Text>
        {iconButton ? (
          <Pressable
            testID='page-title-icon-button'
            onPress={iconButton.onPress}
          >
            <Text>{iconButton.accessibilityLabel ?? 'icon-button'}</Text>
            <Text>
              {iconButton.enableHaptics
                ? 'icon-button-haptics-on'
                : 'icon-button-haptics-off'}
            </Text>
          </Pressable>
        ) : null}
        {button ? (
          <Pressable testID='page-title-button' onPress={button.onPress}>
            <Text>{button.label ?? 'button'}</Text>
            <Text>{button.variant ?? 'primary'}</Text>
            <Text>
              {button.enableHaptics
                ? 'button-haptics-on'
                : 'button-haptics-off'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    WeatherAttribution: () => <View testID='weather-attribution' />,
  };
});

const mockUseHomeDashboardState = useHomeDashboardState as jest.MockedFunction<
  typeof useHomeDashboardState
>;
const mockFetchSpeciesWithModels =
  fetchSpeciesWithModels as jest.MockedFunction<typeof fetchSpeciesWithModels>;

const mockHistoryReplaceState = jest.fn();
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

describe('WebHomeDashboard', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      contentWidth: 720,
    });
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState: mockHistoryReplaceState,
      },
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://wherewild.test/',
      },
    });
    Object.defineProperty(window, 'addEventListener', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'removeEventListener', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: mockSessionStorage,
    });
    mockHistoryReplaceState.mockClear();
    mockSessionStorage.getItem.mockClear();
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.clear();
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'all',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: false,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hides the filter by default on web home', () => {
    render(<WebHomeDashboard />);

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Filter')).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('button-haptics-on')).toBeTruthy();
    expect(screen.queryByTestId('home-recommendation-filter')).toBeNull();
  });

  it('preserves filter visibility across a remount', () => {
    const { unmount } = render(<WebHomeDashboard />);

    fireEvent.press(screen.getByTestId('page-title-button'));

    expect(screen.getByText('Hide filter')).toBeTruthy();
    expect(screen.getByTestId('home-recommendation-filter')).toBeTruthy();

    unmount();

    render(<WebHomeDashboard />);

    expect(screen.getByText('Hide filter')).toBeTruthy();
    expect(screen.getByTestId('home-recommendation-filter')).toBeTruthy();
  });

  it('auto-opens the filter when a non-default filter is restored', () => {
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: true,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });

    render(<WebHomeDashboard />);

    expect(screen.getByText('Hide filter')).toBeTruthy();
    expect(screen.getByTestId('home-recommendation-filter')).toBeTruthy();
    expect(screen.getByTestId('page-title-icon-button')).toBeTruthy();
    expect(screen.getByText('icon-button-haptics-on')).toBeTruthy();
  });

  it('hydrates the persisted active group on mount', () => {
    mockSessionStorage.setItem('wherewild.home.activeGroup', 'plants');

    render(<WebHomeDashboard />);

    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      initialActiveGroup: 'plants',
    });
    expect(screen.getByText('Hide filter')).toBeTruthy();
  });

  it('does not overwrite a persisted active group before remote hydration restores matching grouped data', async () => {
    const actualModule = jest.requireActual(
      '@/hooks/useHomeDashboardState',
    ) as {
      useHomeDashboardState: typeof useHomeDashboardState;
    };

    mockSessionStorage.setItem('wherewild.home.activeGroup', 'plants');
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
    ] as never);
    mockUseHomeDashboardState.mockImplementation((...args) =>
      actualModule.useHomeDashboardState(...args),
    );

    render(<WebHomeDashboard />);

    expect(screen.getByText('Hide filter')).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
    });

    const persistedActiveGroupWrites = mockSessionStorage.setItem.mock.calls
      .filter(([key]) => key === 'wherewild.home.activeGroup')
      .map(([, value]: [string, string]) => value);

    expect(persistedActiveGroupWrites).toContain('plants');
    expect(persistedActiveGroupWrites).not.toContain('all');
  });

  it('applies stacked layout styles on phone breakpoints', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      contentWidth: 360,
    });

    render(<WebHomeDashboard />);

    expect(
      StyleSheet.flatten(screen.getByTestId('web-map-layout').props.style)
        .flexDirection,
    ).toBe('column');
    expect(
      StyleSheet.flatten(screen.getByTestId('web-map-section').props.style)
        .width,
    ).toBe('100%');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('active-near-you-section').props.style,
      ).width,
    ).toBe('100%');
  });

  it('restores filter visibility and active group from popstate', () => {
    const setActiveGroup = jest.fn();
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'all',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: false,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup,
    });

    const { unmount } = render(<WebHomeDashboard />);

    const popstateHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(
      ([eventName]: [string]) => eventName === 'popstate',
    )?.[1] as (() => void) | undefined;

    expect(popstateHandler).toBeDefined();

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: {
          home: {
            filterVisible: true,
            activeGroup: 'birds',
          },
        },
        replaceState: mockHistoryReplaceState,
      },
    });

    act(() => {
      popstateHandler?.();
    });

    expect(setActiveGroup).toHaveBeenCalledWith('birds');
    expect(screen.getByText('Hide filter')).toBeTruthy();

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      'popstate',
      popstateHandler,
    );
  });

  it('resets the active group from the title icon button', () => {
    const setActiveGroup = jest.fn();
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: true,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup,
    });

    render(<WebHomeDashboard />);

    fireEvent.press(screen.getByTestId('page-title-icon-button'));

    expect(setActiveGroup).toHaveBeenCalledWith('all');
  });

  it('falls back cleanly when session storage and replaceState are unavailable', () => {
    Reflect.deleteProperty(window, 'sessionStorage');
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
      },
    });

    render(<WebHomeDashboard />);

    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      initialActiveGroup: 'all',
    });
    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('falls back cleanly when session storage access throws', () => {
    const securityError = new DOMException('Blocked', 'SecurityError');

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw securityError;
      },
    });

    expect(() => render(<WebHomeDashboard />)).not.toThrow();
    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      initialActiveGroup: 'all',
    });
    expect(mockHistoryReplaceState).toHaveBeenCalled();
  });

  it('falls back cleanly when session storage methods throw', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new DOMException('Blocked', 'SecurityError');
        }),
        setItem: jest.fn(() => {
          throw new DOMException('Blocked', 'SecurityError');
        }),
      },
    });

    expect(() => render(<WebHomeDashboard />)).not.toThrow();
    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      initialActiveGroup: 'all',
    });
    expect(mockHistoryReplaceState).toHaveBeenCalled();
  });

  it('skips popstate wiring when window listeners are unavailable', () => {
    Object.defineProperty(window, 'addEventListener', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'removeEventListener', {
      configurable: true,
      value: undefined,
    });

    render(<WebHomeDashboard />);

    expect(screen.getByText('Filter')).toBeTruthy();
  });
});
