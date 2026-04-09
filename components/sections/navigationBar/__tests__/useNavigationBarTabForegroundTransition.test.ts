import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import {
  __NAVIGATION_BAR_TAB_FOREGROUND_TRANSITION_TESTING__,
  useNavigationBarTabForegroundTransition,
} from '../useNavigationBarTabForegroundTransition';

describe('useNavigationBarTabForegroundTransition', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns target colors on initial render without animating', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    const { result } = renderHook(() =>
      useNavigationBarTabForegroundTransition({
        targetColors: {
          textColor: '#111111',
          iconColor: '#222222',
        },
        animationKey: 'light|default',
      }),
    );

    expect(result.current).toEqual({
      textColor: '#111111',
      iconColor: '#222222',
    });
    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('does not animate when rerendered colors are unchanged', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    const { rerender } = renderHook(
      ({
        targetColors,
        animationKey,
      }: {
        targetColors: { textColor: string; iconColor: string };
        animationKey: string;
      }) =>
        useNavigationBarTabForegroundTransition({ targetColors, animationKey }),
      {
        initialProps: {
          targetColors: {
            textColor: '#111111',
            iconColor: '#222222',
          },
          animationKey: 'light|default',
        },
      },
    );

    act(() => {
      rerender({
        targetColors: {
          textColor: '#111111',
          iconColor: '#222222',
        },
        animationKey: 'light|default-2',
      });
    });

    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('animates to new target colors when they change', async () => {
    const start = jest.fn(
      (callback?: (result: { finished: boolean }) => void) => {
        callback?.({ finished: true });
      },
    );
    const stop = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop,
    } as unknown as Animated.CompositeAnimation);

    const { result, rerender } = renderHook(
      ({
        targetColors,
        animationKey,
      }: {
        targetColors: { textColor: string; iconColor: string };
        animationKey: string;
      }) =>
        useNavigationBarTabForegroundTransition({ targetColors, animationKey }),
      {
        initialProps: {
          targetColors: {
            textColor: '#111111',
            iconColor: '#222222',
          },
          animationKey: 'light|default',
        },
      },
    );

    act(() => {
      rerender({
        targetColors: {
          textColor: '#333333',
          iconColor: '#444444',
        },
        animationKey: 'light|on-brand',
      });
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        textColor: '#333333',
        iconColor: '#444444',
      });
    });

    expect(timingSpy).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('removes listener and keeps previous colors when animation ends unfinished', async () => {
    const start = jest.fn(
      (callback?: (result: { finished: boolean }) => void) => {
        callback?.({ finished: false });
      },
    );
    const stop = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop,
    } as unknown as Animated.CompositeAnimation);
    const removeListenerSpy = jest.spyOn(
      Animated.Value.prototype,
      'removeListener',
    );

    const { result, rerender } = renderHook(
      ({
        targetColors,
        animationKey,
      }: {
        targetColors: { textColor: string; iconColor: string };
        animationKey: string;
      }) =>
        useNavigationBarTabForegroundTransition({ targetColors, animationKey }),
      {
        initialProps: {
          targetColors: {
            textColor: '#111111',
            iconColor: '#222222',
          },
          animationKey: 'light|default',
        },
      },
    );

    act(() => {
      rerender({
        targetColors: {
          textColor: '#333333',
          iconColor: '#444444',
        },
        animationKey: 'light|on-brand',
      });
    });

    await waitFor(() => {
      expect(timingSpy).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
      expect(removeListenerSpy).toHaveBeenCalled();
    });

    expect(result.current).not.toEqual({
      textColor: '#333333',
      iconColor: '#444444',
    });
  });

  it('stops in-flight animation and removes listener on unmount', () => {
    const start = jest.fn();
    const stop = jest.fn();
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop,
    } as unknown as Animated.CompositeAnimation);
    const removeListenerSpy = jest.spyOn(
      Animated.Value.prototype,
      'removeListener',
    );

    const { rerender, unmount } = renderHook(
      ({
        targetColors,
        animationKey,
      }: {
        targetColors: { textColor: string; iconColor: string };
        animationKey: string;
      }) =>
        useNavigationBarTabForegroundTransition({ targetColors, animationKey }),
      {
        initialProps: {
          targetColors: {
            textColor: '#111111',
            iconColor: '#222222',
          },
          animationKey: 'light|default',
        },
      },
    );

    act(() => {
      rerender({
        targetColors: {
          textColor: '#333333',
          iconColor: '#444444',
        },
        animationKey: 'light|on-brand',
      });
    });

    act(() => {
      unmount();
    });

    expect(stop).toHaveBeenCalled();
    expect(removeListenerSpy).toHaveBeenCalled();
  });

  it('covers helper parsing and clamping behavior', () => {
    const helpers = __NAVIGATION_BAR_TAB_FOREGROUND_TRANSITION_TESTING__;

    expect(helpers.clampUnit(-1)).toBe(0);
    expect(helpers.clampUnit(0.25)).toBe(0.25);
    expect(helpers.clampUnit(5)).toBe(1);

    expect(helpers.colorToChannels('not-a-color')).toEqual({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 1,
    });

    const mixed = helpers.mixColor('#ff0000', '#00ff00', 2);
    expect(mixed).toBe('rgba(0, 255, 0, 1.000)');
  });

  it('updates animated colors from listener interpolation values', async () => {
    const listenerCallbacks: ((event: { value: number }) => void)[] = [];
    jest
      .spyOn(Animated.Value.prototype, 'addListener')
      .mockImplementation((callback) => {
        listenerCallbacks.push(callback);
        return 'listener-id';
      });

    const start = jest.fn();
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop: jest.fn(),
    } as unknown as Animated.CompositeAnimation);

    const { result, rerender } = renderHook(
      ({
        targetColors,
        animationKey,
      }: {
        targetColors: { textColor: string; iconColor: string };
        animationKey: string;
      }) =>
        useNavigationBarTabForegroundTransition({ targetColors, animationKey }),
      {
        initialProps: {
          targetColors: {
            textColor: '#ff0000',
            iconColor: '#0000ff',
          },
          animationKey: 'light|default',
        },
      },
    );

    act(() => {
      rerender({
        targetColors: {
          textColor: '#00ff00',
          iconColor: '#ff00ff',
        },
        animationKey: 'light|on-brand',
      });
    });

    act(() => {
      listenerCallbacks[0]?.({ value: 0.5 });
    });

    await waitFor(() => {
      expect(result.current.textColor).toBe('rgba(128, 128, 0, 1.000)');
      expect(result.current.iconColor).toBe('rgba(128, 0, 255, 1.000)');
    });
  });
});
