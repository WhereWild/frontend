import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import HomeScreen from '../index';

const mockUseNativeHomeTabs = jest.fn();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
  }
};

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    contentWidth: 720,
    breakpoint: 'desktop',
    gap: 24,
    marginHorizontal: 32,
  }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => undefined),
}));

jest.mock('@/context/NativeHomeTabsContext', () => ({
  useNativeHomeTabs: () => mockUseNativeHomeTabs(),
}));

jest.mock('../../components/sections/WebHomeDashboard', () => ({
  WebHomeDashboard: () => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return <View testID='web-home-dashboard' />;
  },
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');

  return {
    ActiveNearYouSection: ({
      style,
      loading,
      nativeFirstItemTopMargin,
      onNativeScrolledChange,
    }: {
      style?: unknown;
      loading?: boolean;
      nativeFirstItemTopMargin?: number;
      onNativeScrolledChange?: (isScrolled: boolean) => void;
    }) => (
      <View testID='active-near-you-section' style={style}>
        <Text testID='active-near-you-loading-state'>
          {loading ? 'loading' : 'loaded'}
        </Text>
        <View
          testID='active-near-you-first-item-wrapper'
          style={
            nativeFirstItemTopMargin
              ? { marginTop: nativeFirstItemTopMargin }
              : undefined
          }
        />
        <Pressable
          testID='active-near-you-scroll-state-on'
          onPress={() => onNativeScrolledChange?.(true)}
        >
          <Text>Scrolled</Text>
        </Pressable>
        <Pressable
          testID='active-near-you-scroll-state-off'
          onPress={() => onNativeScrolledChange?.(false)}
        >
          <Text>At Top</Text>
        </Pressable>
        <Text>Active Near You</Text>
      </View>
    ),
    HomeRecommendationFilter: ({ activeGroup }: { activeGroup: string }) => (
      <Text testID='shared-filter-group'>{activeGroup}</Text>
    ),
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

const flattenStyle = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style) as ViewStyle;

describe('Home screen', () => {
  beforeEach(() => {
    restorePlatformOS();
    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      isFilterVisible: true,
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });
  });

  it('renders the shared filter above the list content', () => {
    const { UNSAFE_getByProps } = render(<HomeScreen />);

    expect(screen.getByText('Active Near You')).toBeTruthy();
    expect(screen.getByTestId('shared-filter-group').props.children).toBe(
      'plants',
    );
    expect(
      screen.getByTestId('active-near-you-loading-state').props.children,
    ).toBe('loaded');
    expect(
      UNSAFE_getByProps({ testID: 'explore-filter-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(false);
    expect(
      flattenStyle(
        UNSAFE_getByProps({ testID: 'explore-filter-slot' }).props.style,
      ).paddingTop,
    ).toBe(24);
    expect(
      flattenStyle(screen.getByTestId('native-explore-content').props.style)
        .paddingTop,
    ).toBeUndefined();
    expect(
      flattenStyle(screen.getByTestId('active-near-you-section').props.style)
        .marginTop,
    ).toBeUndefined();
    expect(
      flattenStyle(
        screen.getByTestId('active-near-you-first-item-wrapper').props.style,
      ),
    ).toBeUndefined();
    expect(
      flattenStyle(screen.getByTestId('explore-filter-surface').props.style)
        .paddingBottom,
    ).toBe(24);
    expect(
      flattenStyle(screen.getByTestId('explore-filter-shadow-seam').props.style)
        .elevation,
    ).toBeUndefined();

    fireEvent.press(screen.getByTestId('active-near-you-scroll-state-on'));

    expect(
      flattenStyle(screen.getByTestId('explore-filter-shadow-seam').props.style)
        .elevation,
    ).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId('active-near-you-scroll-state-off'));

    expect(
      flattenStyle(screen.getByTestId('explore-filter-shadow-seam').props.style)
        .elevation,
    ).toBeUndefined();
  });

  it('hides the shared filter when native filter visibility is disabled', () => {
    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      isFilterVisible: false,
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });

    const { UNSAFE_getByProps } = render(<HomeScreen />);

    expect(
      UNSAFE_getByProps({ testID: 'explore-filter-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      flattenStyle(screen.getByTestId('active-near-you-section').props.style)
        .marginTop,
    ).toBeUndefined();
    expect(
      flattenStyle(
        screen.getByTestId('active-near-you-first-item-wrapper').props.style,
      ).marginTop,
    ).toBe(24);
  });

  it('keeps the filter shadow when filters reopen while already scrolled', () => {
    const { rerender } = render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('active-near-you-scroll-state-on'));

    expect(
      flattenStyle(screen.getByTestId('explore-filter-shadow-seam').props.style)
        .elevation,
    ).toBeGreaterThan(0);

    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      isFilterVisible: false,
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });

    rerender(<HomeScreen />);

    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      isFilterVisible: true,
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });

    rerender(<HomeScreen />);

    expect(
      flattenStyle(screen.getByTestId('explore-filter-shadow-seam').props.style)
        .elevation,
    ).toBeGreaterThan(0);
  });

  it('renders the web dashboard on web', () => {
    setPlatformOS('web');

    const { queryByTestId, getByTestId } = render(<HomeScreen />);

    expect(getByTestId('web-home-dashboard')).toBeTruthy();
    expect(queryByTestId('native-explore-content')).toBeNull();
  });

  it('passes scores loading through to Active Near You', () => {
    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      isFilterVisible: true,
      recommendations: [],
      scoresLoading: true,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });

    render(<HomeScreen />);

    expect(
      screen.getByTestId('active-near-you-loading-state').props.children,
    ).toBe('loading');
  });
});
