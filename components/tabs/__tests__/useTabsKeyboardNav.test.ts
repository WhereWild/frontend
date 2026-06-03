// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import { useTabsKeyboardNav } from '../useTabsKeyboardNav';

const tabs = [{ key: 'one' }, { key: 'two' }, { key: 'three' }];

describe('useTabsKeyboardNav', () => {
  type HookProps = { selectedKey: string };
  type HookResult = ReturnType<typeof useTabsKeyboardNav>;

  it('does not initialize roving focus when keyboard navigation is disabled', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useTabsKeyboardNav({
        tabs,
        selectedKey: 'one',
        onSelectionChange,
        enabled: false,
      }),
    );

    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.focusedIndex).toBeNull();
  });

  it('syncs focusedIndex to controlled selectedKey changes', () => {
    const onSelectionChange = jest.fn();
    const { result, rerender } = renderHook<HookResult, HookProps>(
      ({ selectedKey }) =>
        useTabsKeyboardNav({
          tabs,
          selectedKey,
          onSelectionChange,
        }),
      {
        initialProps: { selectedKey: 'one' },
      },
    );

    expect(result.current.focusedIndex).toBe(0);

    rerender({ selectedKey: 'three' });

    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.focusedIndex).toBe(2);
  });

  it('wraps focus with arrow navigation and calls preventDefault', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useTabsKeyboardNav({
        tabs,
        selectedKey: 'one',
        onSelectionChange,
      }),
    );

    const focusOne = jest.fn();
    const focusThree = jest.fn();

    act(() => {
      result.current.setTabRefForIndex(0)({ focus: focusOne } as never);
      result.current.setTabRefForIndex(2)({ focus: focusThree } as never);
    });

    const preventDefault = jest.fn();

    act(() => {
      result.current.onKeyDownForIndex(0)({
        nativeEvent: { key: 'ArrowLeft' },
        preventDefault,
      });
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(focusThree).toHaveBeenCalled();
    expect(result.current.focusedIndex).toBe(2);
  });

  it('activates the focused tab on Enter and the indexed tab on Space when focus is unset', () => {
    const onSelectionChange = jest.fn();
    const { result, rerender } = renderHook<HookResult, HookProps>(
      ({ selectedKey }) =>
        useTabsKeyboardNav({
          tabs,
          selectedKey,
          onSelectionChange,
        }),
      {
        initialProps: { selectedKey: 'one' },
      },
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });

    const preventEnter = jest.fn();
    act(() => {
      result.current.onKeyDownForIndex(0)({
        nativeEvent: { key: 'Enter' },
        preventDefault: preventEnter,
      });
    });

    expect(preventEnter).toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenCalledWith('three');

    rerender({ selectedKey: 'missing' });

    act(() => {
      result.current.setFocusedIndex(null);
    });

    const preventSpace = jest.fn();
    act(() => {
      result.current.onKeyDownForIndex(1)({
        nativeEvent: { key: ' ' },
        preventDefault: preventSpace,
      });
    });

    expect(preventSpace).toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenCalledWith('two');
  });

  it('ignores empty key events and duplicate selection requests', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useTabsKeyboardNav({
        tabs,
        selectedKey: 'one',
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.onKeyDownForIndex(0)({});
      result.current.handleSelectionChange('one');
    });

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('handles arrow navigation safely when there are no tabs', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useTabsKeyboardNav({
        tabs: [],
        selectedKey: 'missing',
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.onKeyDownForIndex(0)({
        nativeEvent: { key: 'ArrowRight' },
        preventDefault: jest.fn(),
      });
    });

    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.focusedIndex).toBe(0);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
