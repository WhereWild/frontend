// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import React from 'react';
import { TextInput, type PressableStateCallbackType } from 'react-native';
import {
  handleClearValue,
  submitSearchValue,
  resolveIconButtonInteractionStyles,
  createContainerHandlers,
} from '../searchInputHelpers';

describe('searchInputHelpers', () => {
  const createPressableState = (
    overrides: Partial<PressableStateCallbackType>,
  ): PressableStateCallbackType => ({
    pressed: false,
    hovered: false,
    ...overrides,
  });

  describe('handleClearValue', () => {
    it('does not clear when disabled', () => {
      const ref = { current: 'value' };
      const setInternalValue = jest.fn();
      const onQueryChange = jest.fn();
      const onClear = jest.fn();

      const result = handleClearValue({
        disabled: true,
        isControlled: false,
        setInternalValue,
        previousValueRef: ref,
        onQueryChange,
        onClear,
      });

      expect(result).toBe(false);
      expect(setInternalValue).not.toHaveBeenCalled();
      expect(onQueryChange).not.toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
    });

    it('clears value and notifies callbacks in uncontrolled mode', () => {
      const ref = { current: 'seed' };
      const setInternalValue = jest.fn();
      const onQueryChange = jest.fn();
      const onClear = jest.fn();

      const result = handleClearValue({
        disabled: false,
        isControlled: false,
        setInternalValue,
        previousValueRef: ref,
        onQueryChange,
        onClear,
      });

      expect(result).toBe(true);
      expect(ref.current).toBe('');
      expect(setInternalValue).toHaveBeenCalledWith('');
      expect(onQueryChange).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalled();
    });

    it('clears value without mutating internal state in controlled mode', () => {
      const ref = { current: 'seed' };
      const setInternalValue = jest.fn();
      const onQueryChange = jest.fn();
      const onClear = jest.fn();

      const result = handleClearValue({
        disabled: false,
        isControlled: true,
        setInternalValue,
        previousValueRef: ref,
        onQueryChange,
        onClear,
      });

      expect(result).toBe(true);
      expect(ref.current).toBe('');
      expect(setInternalValue).not.toHaveBeenCalled();
      expect(onQueryChange).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('submitSearchValue', () => {
    it('submits only when enabled', () => {
      const onSubmit = jest.fn();
      const disabledResult = submitSearchValue(true, 'lynx', onSubmit);
      const enabledResult = submitSearchValue(false, 'lynx', onSubmit);

      expect(disabledResult).toBe(false);
      expect(enabledResult).toBe(true);
      expect(onSubmit).toHaveBeenCalledWith('lynx');
    });
  });

  describe('resolveIconButtonInteractionStyles', () => {
    it('resolves pressed and hovered styles for icon buttons', () => {
      const palette = Colors.light;
      const result = resolveIconButtonInteractionStyles({
        palette,
        baseIconColor: '#123456',
        disabled: false,
        state: createPressableState({ pressed: true }),
      });

      expect(result.containerStyle).toMatchObject({
        backgroundColor: palette.background.neutral.tertiaryPressed,
      });
      expect(result.iconColor).toBe(palette.icon.neutral.onNeutralTertiary);
    });

    it('applies hover styles when hovered but not pressed', () => {
      const palette = Colors.light;
      const result = resolveIconButtonInteractionStyles({
        palette,
        baseIconColor: '#abcdef',
        disabled: false,
        state: createPressableState({ hovered: true }),
      });

      expect(result.containerStyle).toMatchObject({
        backgroundColor: palette.background.neutral.tertiaryHover,
      });
      expect(result.iconColor).toBe(palette.icon.neutral.onNeutralTertiary);
    });
  });

  describe('createContainerHandlers', () => {
    it('focuses input via container handlers when enabled', () => {
      const focus = jest.fn();
      const inputRef = {
        current: { focus },
      } as unknown as React.RefObject<TextInput>;
      const handlers = createContainerHandlers({
        disabled: false,
        inputRef,
        setIsHovered: jest.fn(),
        setIsPressing: jest.fn(),
      });

      handlers.onPress();

      expect(focus).toHaveBeenCalled();
    });

    it('skips focus when disabled and toggles hover/press setters', () => {
      const focus = jest.fn();
      const inputRef = {
        current: { focus },
      } as unknown as React.RefObject<TextInput>;
      const setIsHovered = jest.fn();
      const setIsPressing = jest.fn();

      const handlers = createContainerHandlers({
        disabled: true,
        inputRef,
        setIsHovered,
        setIsPressing,
      });

      handlers.onPress();
      expect(focus).not.toHaveBeenCalled();

      handlers.onHoverIn();
      handlers.onHoverOut();
      handlers.onPressIn();
      handlers.onPressOut();

      expect(setIsHovered).toHaveBeenNthCalledWith(1, true);
      expect(setIsHovered).toHaveBeenNthCalledWith(2, false);
      expect(setIsPressing).toHaveBeenNthCalledWith(1, true);
      expect(setIsPressing).toHaveBeenNthCalledWith(2, false);
    });
  });
});
