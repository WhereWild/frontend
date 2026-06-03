// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Time } from '@/constants/theme';
import { LeadingContent } from '../TopAppBarLeadingContent.native';
import { TOP_APP_BAR_SEARCH_SLIDE_OFFSET } from '../TopAppBar.constants';
import { mockAnimatedTiming } from '../topAppBarTestUtils';
import { Animated } from 'react-native';

describe('TopAppBarLeadingContent', () => {
  beforeAll(() => {
    mockAnimatedTiming();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('renders search leading content with default placeholder and calls search handlers', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    render(
      <LeadingContent
        variant='search'
        searchValue=''
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />,
    );

    const input = screen.getByLabelText('Search input');
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();

    fireEvent.changeText(input, 'otter');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'otter' } });

    expect(onSearchValueChange).toHaveBeenCalledWith('otter');
    expect(onSubmitSearch).toHaveBeenCalledWith('otter');
  });

  it('renders page leading content and triggers onPressBack', () => {
    const onPressBack = jest.fn();

    render(
      <LeadingContent
        variant='page'
        title='Species'
        onPressBack={onPressBack}
      />,
    );

    expect(screen.getByText('Species')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onPressBack).toHaveBeenCalledTimes(1);
  });

  it('renders home leading content as image when logo is not pressable', () => {
    render(
      <LeadingContent
        variant='home'
        title='WhereWild'
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel='WhereWild logo'
      />,
    );

    expect(screen.getByLabelText('WhereWild logo')).toBeTruthy();
    expect(screen.getByText('WhereWild')).toBeTruthy();
  });

  it('renders home leading content with pressable logo when onPressLogo is provided', () => {
    const onPressLogo = jest.fn();

    render(
      <LeadingContent
        variant='home'
        title='WhereWild'
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel='WhereWild logo'
        onPressLogo={onPressLogo}
      />,
    );

    fireEvent.press(screen.getByLabelText('WhereWild logo'));
    expect(onPressLogo).toHaveBeenCalledTimes(1);
  });

  it('transitions leading content from page to search and back to page', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    const { rerender } = render(
      <LeadingContent variant='page' title='Species' onPressBack={jest.fn()} />,
    );

    rerender(
      <LeadingContent
        variant='search'
        searchValue=''
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />,
    );

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'fox');
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'fox' } });
    expect(onSearchValueChange).toHaveBeenCalledWith('fox');
    expect(onSubmitSearch).toHaveBeenCalledWith('fox');

    rerender(
      <LeadingContent
        variant='page'
        title='Species Details'
        onPressBack={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('Search input')).toBeNull();
    expect(screen.getByText('Species Details')).toBeTruthy();
  });

  it('keeps search and non-search leading slots mounted while toggling visibility', () => {
    const { UNSAFE_getByProps, rerender } = render(
      <LeadingContent variant='page' title='Species' onPressBack={jest.fn()} />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'top-app-bar-leading-search-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      screen.getByTestId('top-app-bar-leading-non-search-slot').props
        .accessibilityElementsHidden,
    ).toBe(false);

    rerender(
      <LeadingContent
        variant='search'
        searchValue='fox'
        onSearchValueChange={jest.fn()}
        onSubmitSearch={jest.fn()}
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'top-app-bar-leading-search-slot' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'top-app-bar-leading-non-search-slot' }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('top-app-bar-leading-search-slot').props
        .accessibilityElementsHidden,
    ).toBe(false);
    expect(
      UNSAFE_getByProps({ testID: 'top-app-bar-leading-non-search-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });

  it('animates home to page transition right-to-left', () => {
    const timingMock = Animated.timing as unknown as jest.Mock;

    const { rerender } = render(
      <LeadingContent
        variant='home'
        title='WhereWild'
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel='WhereWild logo'
      />,
    );

    timingMock.mockClear();

    rerender(
      <LeadingContent variant='page' title='Species' onPressBack={jest.fn()} />,
    );

    const hasExitLeftAnimation = timingMock.mock.calls.some(([, config]) => {
      const toValue = (config as { toValue?: unknown } | undefined)?.toValue;
      return (
        typeof toValue === 'number' &&
        toValue === -TOP_APP_BAR_SEARCH_SLIDE_OFFSET
      );
    });

    expect(hasExitLeftAnimation).toBe(true);
  });

  it('does not run delayed slot tween when transitioning from search to page', () => {
    const timingMock = Animated.timing as unknown as jest.Mock;

    const { rerender } = render(
      <LeadingContent
        variant='search'
        searchValue=''
        onSearchValueChange={jest.fn()}
        onSubmitSearch={jest.fn()}
      />,
    );

    timingMock.mockClear();

    rerender(
      <LeadingContent variant='page' title='Species' onPressBack={jest.fn()} />,
    );

    const hasShortDurationSlotTween = timingMock.mock.calls.some(
      ([, config]) => {
        const duration = (config as { duration?: unknown } | undefined)
          ?.duration;
        return typeof duration === 'number' && duration === Time.duration.short;
      },
    );

    expect(hasShortDurationSlotTween).toBe(false);
  });

  it('does not run delayed slot tween when transitioning directly from home to page', () => {
    const timingMock = Animated.timing as unknown as jest.Mock;

    const { rerender } = render(
      <LeadingContent
        variant='home'
        title='WhereWild'
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel='WhereWild logo'
      />,
    );

    timingMock.mockClear();

    rerender(
      <LeadingContent variant='page' title='Species' onPressBack={jest.fn()} />,
    );

    const hasShortDurationSlotTween = timingMock.mock.calls.some(
      ([, config]) => {
        const duration = (config as { duration?: unknown } | undefined)
          ?.duration;
        return typeof duration === 'number' && duration === Time.duration.short;
      },
    );

    expect(hasShortDurationSlotTween).toBe(false);
  });
});
