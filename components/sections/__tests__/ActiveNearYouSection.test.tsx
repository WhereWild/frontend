// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Size } from '@/constants/theme';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { ActiveNearYouSection } from '../ActiveNearYouSection';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({ breakpoint: 'desktop', gap: 16 })),
}));

jest.mock('../../cards/SpeciesCard', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    SpeciesCard: ({
      commonName,
      size,
      loading,
    }: {
      commonName: string;
      size?: 'default' | 'compact';
      loading?: boolean;
    }) => (
      <Text
        testID={loading ? 'species-card-loading' : `species-card-${commonName}`}
      >
        {loading
          ? `loading:${size ?? 'default'}`
          : `${commonName}:${size ?? 'default'}`}
      </Text>
    ),
  };
});

const recommendations = [
  {
    taxonId: 1,
    commonName: 'Plant One',
    commonNames: ['Plant One'],
    scientificName: 'Plantus one',
    description: 'Warm slopes',
    taxonGroup: 'plants',
  },
  {
    taxonId: 2,
    commonName: 'Bird Two',
    commonNames: ['Bird Two'],
    scientificName: 'Birdus two',
    description: 'Open scrub',
    taxonGroup: 'birds',
  },
  {
    taxonId: 3,
    commonName: 'Fungus Three',
    commonNames: ['Fungus Three'],
    scientificName: 'Fungus three',
    description: 'Moist shade',
    taxonGroup: 'fungi',
  },
];

const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;
const flattenStyle = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style) as ViewStyle;

describe('ActiveNearYouSection', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      gap: 16,
    } as ReturnType<typeof useResponsive>);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('renders all provided species by default', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
      />,
    );

    expect(screen.getByText('Plant One:default')).toBeTruthy();
    expect(screen.getByText('Bird Two:default')).toBeTruthy();
    expect(screen.getByText('Fungus Three:default')).toBeTruthy();
  });

  it('filters the displayed species using the activeGroup prop', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        activeGroup='plants'
      />,
    );

    expect(screen.getByText('Plant One:default')).toBeTruthy();
    expect(screen.queryByText('Bird Two:default')).toBeNull();
    expect(screen.queryByText('Fungus Three:default')).toBeNull();
  });

  it('uses 400 gap with default cards on web', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      gap: 16,
    } as ReturnType<typeof useResponsive>);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
      />,
    );

    expect(
      flattenStyle(screen.getByTestId('active-near-you-list').props.style).gap,
    ).toBe(Size.space['400']);
    expect(
      flattenStyle(screen.getByTestId('active-near-you-section').props.style)
        .gap,
    ).toBe(Size.space['400']);
  });

  it('renders compact species cards with 200 gap on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      gap: 16,
    } as ReturnType<typeof useResponsive>);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
      />,
    );

    expect(screen.getByText('Plant One:compact')).toBeTruthy();
    expect(screen.getByText('Bird Two:compact')).toBeTruthy();
    expect(
      flattenStyle(screen.getByTestId('active-near-you-list').props.style).gap,
    ).toBe(Size.space['200']);
  });

  it('renders loading placeholder cards while loading', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        loading
      />,
    );

    expect(screen.getAllByTestId('species-card-loading')).toHaveLength(5);
    expect(screen.queryByText('Plant One:default')).toBeNull();
  });

  it('hides the heading when showHeading is false', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { UNSAFE_getByProps } = render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-heading-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      flattenStyle(screen.getByTestId('active-near-you-section').props.style)
        .gap,
    ).toBeUndefined();
  });

  it('hides the heading on native', () => {
    const { UNSAFE_getByProps } = render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-heading-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      flattenStyle(
        screen.getByTestId('active-near-you-native-list').props
          .contentContainerStyle,
      ).paddingTop,
    ).toBe(0);
  });

  it('applies native top margin to the first item wrapper', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        nativeFirstItemTopMargin={24}
      />,
    );

    expect(
      flattenStyle(
        screen.getByTestId('active-near-you-native-item-wrapper-0').props.style,
      ).marginTop,
    ).toBe(24);
  });

  it('keeps native row slots mounted when the visible item count shrinks', () => {
    const { UNSAFE_getByProps, rerender } = render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        activeGroup='all'
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-0' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-1' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-2' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-3' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-4' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-2' })
        .props.accessibilityElementsHidden,
    ).toBe(false);

    rerender(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        activeGroup='plants'
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-0' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-1' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-2' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-3' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-4' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'active-near-you-native-item-wrapper-1' })
        .props.accessibilityElementsHidden,
    ).toBe(true);
  });

  it('reports native scroll state changes', () => {
    const handleNativeScrolledChange = jest.fn();

    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        onNativeScrolledChange={handleNativeScrolledChange}
      />,
    );

    const nativeList = screen.getByTestId('active-near-you-native-list');

    expect(handleNativeScrolledChange).toHaveBeenCalledWith(false);

    fireEvent.scroll(nativeList, {
      nativeEvent: {
        contentOffset: { y: 12, x: 0 },
        contentSize: { height: 400, width: 200 },
        layoutMeasurement: { height: 200, width: 200 },
      },
    });
    fireEvent.scroll(nativeList, {
      nativeEvent: {
        contentOffset: { y: 24, x: 0 },
        contentSize: { height: 400, width: 200 },
        layoutMeasurement: { height: 200, width: 200 },
      },
    });
    fireEvent.scroll(nativeList, {
      nativeEvent: {
        contentOffset: { y: 0, x: 0 },
        contentSize: { height: 400, width: 200 },
        layoutMeasurement: { height: 200, width: 200 },
      },
    });

    expect(handleNativeScrolledChange.mock.calls).toEqual([
      [false],
      [true],
      [false],
    ]);
  });

  it('does not reset native scroll state when the active group changes', () => {
    const handleNativeScrolledChange = jest.fn();

    const { rerender } = render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        activeGroup='all'
        onNativeScrolledChange={handleNativeScrolledChange}
      />,
    );

    const nativeList = screen.getByTestId('active-near-you-native-list');

    fireEvent.scroll(nativeList, {
      nativeEvent: {
        contentOffset: { y: 12, x: 0 },
        contentSize: { height: 400, width: 200 },
        layoutMeasurement: { height: 200, width: 200 },
      },
    });

    rerender(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
        activeGroup='plants'
        onNativeScrolledChange={handleNativeScrolledChange}
      />,
    );

    expect(handleNativeScrolledChange.mock.calls).toEqual([[false], [true]]);
  });
});
