// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Dimensions, Platform, Text } from 'react-native';

import { getResponsive } from '@/constants/responsive';
import { useResponsive } from '../useResponsive';

const TestComponent = () => {
  const responsive = useResponsive();
  return <Text testID="breakpoint">{responsive.breakpoint}</Text>;
};

describe('useResponsive', () => {
  const originalOS = Platform.OS;
  const originalRemoveEventListener = (Dimensions as { removeEventListener?: unknown }).removeEventListener;
  const fallbackWindow = {
    innerWidth: 360,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as any;

  beforeEach(() => {
    (Platform as any).select = jest.fn((options: Record<string, any>) => options[(Platform as any).OS] ?? options.default);
    global.window = fallbackWindow;
  });

  afterEach(() => {
    (Platform as any).OS = originalOS;
    (Dimensions as any).removeEventListener = originalRemoveEventListener;
    global.window = fallbackWindow;
    jest.restoreAllMocks();
  });

  it('uses the Dimensions change handler when the viewport width updates', async () => {
    (Platform as any).OS = 'web';

    const changeHandlers: ((payload: { window: { width?: number } }) => void)[] = [];
    jest.spyOn(Dimensions, 'addEventListener').mockImplementation((type: string, handler: unknown) => {
      if (type === 'change') {
        changeHandlers.push(handler as (payload: { window: { width?: number } }) => void);
      }
      return { remove: jest.fn() } as any;
    });

    (global as any).window = {
      innerWidth: 360,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    const { getByTestId, unmount } = render(<TestComponent />);
    expect(getByTestId('breakpoint').props.children).toBe('phone');

    await act(async () => {
      changeHandlers.forEach((handler) => handler({ window: { width: 1400 } }));
    });

    expect(changeHandlers.length).toBeGreaterThan(0);
    expect(getByTestId('breakpoint').props.children).toBe('desktop');
    expect(Dimensions.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
  });

  it('no-ops when the responsive result is unchanged', async () => {
    (Platform as any).OS = 'web';

    const changeHandlers: ((payload: { window: { width?: number } }) => void)[] = [];
    jest.spyOn(Dimensions, 'addEventListener').mockImplementation((type: string, handler: unknown) => {
      if (type === 'change') {
        changeHandlers.push(handler as (payload: { window: { width?: number } }) => void);
      }
      return { remove: jest.fn() } as any;
    });

    (global as any).window = {
      innerWidth: 360,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    const renderSpy = jest.fn();
    const TestComponentWithSpy = () => {
      const responsive = useResponsive();
      renderSpy(responsive.breakpoint);
      return <Text testID="breakpoint-spy">{responsive.breakpoint}</Text>;
    };

    const { getByTestId, unmount } = render(<TestComponentWithSpy />);
    expect(getByTestId('breakpoint-spy').props.children).toBe('phone');
    // The first render uses the SSR-safe unknown-width guess ('tablet');
    // the mount effect immediately re-measures the real width and corrects
    // it to 'phone' — see useResponsive.ts's comment on why the initial
    // state can't just read window.innerWidth directly. That settling is
    // an unavoidable extra render, so this test only asserts on the
    // outcome it actually cares about: a same-value 'change' event
    // afterward never reports anything other than the already-settled
    // 'phone' breakpoint.
    const settledResults = renderSpy.mock.calls.map((call) => call[0]);
    expect(settledResults[settledResults.length - 1]).toBe('phone');

    await act(async () => {
      changeHandlers.forEach((handler) => handler({ window: { width: 360 } }));
    });

    const allResults = renderSpy.mock.calls.map((call) => call[0]);
    expect(allResults.slice(settledResults.length)).toEqual(
      allResults.slice(settledResults.length).map(() => 'phone'),
    );
    expect(getByTestId('breakpoint-spy').props.children).toBe('phone');

    unmount();
  });

  it('uses window.innerWidth on web and responds to resize', () => {
    (Platform as any).OS = 'web';

    const removeMock = jest.fn();
    jest.spyOn(Dimensions, 'addEventListener').mockReturnValue({ remove: removeMock } as any);
    const resizeHandlers: (() => void)[] = [];
    (global as any).window = {
      innerWidth: 1024,
      addEventListener: jest.fn((type: string, handler: () => void) => {
        if (type === 'resize') resizeHandlers.push(handler);
      }),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn((event: Event) => {
        if (event.type === 'resize') resizeHandlers.forEach((fn) => fn());
        return true;
      }),
    } as any;

    const addResizeSpy = (window as any).addEventListener as jest.Mock;
    const removeResizeSpy = (window as any).removeEventListener as jest.Mock;

    const { getByTestId, unmount } = render(<TestComponent />);
    expect(getByTestId('breakpoint').props.children).toBe('desktop');

    act(() => {
      (window as any).innerWidth = 400;
      window.dispatchEvent(new Event('resize'));
    });

    expect(getByTestId('breakpoint').props.children).toBe('phone');
    expect(addResizeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();
    expect(removeMock).toHaveBeenCalled();
    expect(removeResizeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('falls back to Dimensions legacy removeEventListener on native', () => {
    (Platform as any).OS = 'ios';

    jest.spyOn(Dimensions, 'addEventListener').mockReturnValue(undefined as any);
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 500 } as any);

    const legacyRemove = jest.fn();
    (Dimensions as any).removeEventListener = legacyRemove;

    const { getByTestId, unmount } = render(<TestComponent />);
    expect(getByTestId('breakpoint').props.children).toBe('phone');

    unmount();
    expect(legacyRemove).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('no-ops when no subscription and no legacy remove', () => {
    (Platform as any).OS = 'android';

    jest.spyOn(Dimensions, 'addEventListener').mockReturnValue(undefined as any);
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 300 } as any);
    (Dimensions as any).removeEventListener = undefined;

    const { getByTestId, unmount } = render(<TestComponent />);
    expect(getByTestId('breakpoint').props.children).toBe('phone');

    expect(() => unmount()).not.toThrow();
  });
});
