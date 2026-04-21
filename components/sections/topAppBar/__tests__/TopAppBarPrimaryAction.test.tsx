import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconFilter } from '@/assets/icons';
import { StyleSheet } from 'react-native';
import { PrimaryAction } from '../TopAppBarPrimaryAction.native';
import {
  mockAnimatedTiming,
  resolveAnimatedNumeric,
} from '../topAppBarTestUtils';

describe('TopAppBarPrimaryAction', () => {
  beforeAll(() => {
    mockAnimatedTiming();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('collapses primary action slot when hasPrimaryButton=false', () => {
    render(
      <PrimaryAction
        hasPrimaryButton={false}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    const slotStyle = StyleSheet.flatten(
      screen.getByTestId('top-app-bar-primary-action-slot').props.style,
    );
    expect(resolveAnimatedNumeric(slotStyle.width)).toBe(0);
    expect(resolveAnimatedNumeric(slotStyle.opacity)).toBe(0);
  });

  it('renders primary icon action and disables it when no handler is provided', () => {
    render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={true}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={undefined}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    expect(screen.getByLabelText('Filter action')).toBeDisabled();
  });

  it('renders primary text action and calls handler on press', () => {
    const onPressPrimaryButton = jest.fn();

    render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={onPressPrimaryButton}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter'));
    expect(onPressPrimaryButton).toHaveBeenCalledTimes(1);
  });

  it('does not update measured width when measured width is icon-size or smaller', () => {
    const view = render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    fireEvent(
      view.UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-measure-layout',
      }),
      'layout',
      {
        nativeEvent: { layout: { width: 40, height: 10, x: 0, y: 0 } },
      },
    );

    const slotStyle = StyleSheet.flatten(
      screen.getByTestId('top-app-bar-primary-action-slot').props.style,
    );
    expect(resolveAnimatedNumeric(slotStyle.width)).toBe(0);
  });

  it('updates measured width when measured text button width is greater than icon-size', () => {
    const view = render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    fireEvent(
      view.UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-measure-layout',
      }),
      'layout',
      {
        nativeEvent: { layout: { width: 120, height: 10, x: 0, y: 0 } },
      },
    );

    const slotStyle = StyleSheet.flatten(
      screen.getByTestId('top-app-bar-primary-action-slot').props.style,
    );
    expect(resolveAnimatedNumeric(slotStyle.width)).toBe(120);
  });

  it('keeps icon and button variant slots mounted while toggling visibility', () => {
    const { UNSAFE_getByProps, rerender } = render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={true}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-icon-variant-slot',
      }).props.accessibilityElementsHidden,
    ).toBe(false);
    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-button-variant-slot',
      }).props.accessibilityElementsHidden,
    ).toBe(true);

    rerender(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel='Filter action'
        primaryButtonAccessibilityLabel='Filter'
        primaryButtonLabel='Filter'
      />,
    );

    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-icon-variant-slot',
      }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-button-variant-slot',
      }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-icon-variant-slot',
      }).props.accessibilityElementsHidden,
    ).toBe(true);
    expect(
      UNSAFE_getByProps({
        testID: 'top-app-bar-primary-action-button-variant-slot',
      }).props.accessibilityElementsHidden,
    ).toBe(false);
  });
});
