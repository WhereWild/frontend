import { Animated } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useNavigationBarIndicator } from '../useNavigationBarIndicator';
import {
  animateIndicatorPressedProgress,
  animateIndicatorToLayout,
} from '../navigationBarHelpers';

jest.mock('../navigationBarHelpers', () => {
  const actual = jest.requireActual('../navigationBarHelpers');
  return {
    ...actual,
    animateIndicatorToLayout: jest.fn(),
    animateIndicatorPressedProgress: jest.fn(),
  };
});

describe('useNavigationBarIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('animates indicator movement and color progress when target tab has layout', () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 100, height: 40 },
    };

    const { result } = renderHook(() => useNavigationBarIndicator({
      tabs,
      tabLayouts,
      indicatorTargetIndex: 1,
      previewIndex: 1,
      isResizing: false,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }));

    expect(result.current.indicatorX).toBeInstanceOf(Animated.Value);
    expect(result.current.indicatorWidth).toBeInstanceOf(Animated.Value);
    expect(result.current.indicatorScaleX).toBeInstanceOf(Animated.Value);
    expect(result.current.indicatorBackgroundColor).toBeTruthy();

    expect(animateIndicatorToLayout).toHaveBeenCalledTimes(1);
    expect(animateIndicatorPressedProgress).toHaveBeenCalledTimes(1);
  });

  it('stretches indicator during non-resize target changes and stops on cleanup', () => {
    const timingStart = jest.fn();
    const sequenceStart = jest.fn();
    const sequenceStop = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: timingStart,
      stop: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
    const sequenceSpy = jest.spyOn(Animated, 'sequence').mockReturnValue({
      start: sequenceStart,
      stop: sequenceStop,
    } as unknown as Animated.CompositeAnimation);

    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 100, height: 40 },
    };

    const { rerender, unmount } = renderHook((props: {
      indicatorTargetIndex: number;
      isResizing: boolean;
    }) => useNavigationBarIndicator({
      tabs,
      tabLayouts,
      indicatorTargetIndex: props.indicatorTargetIndex,
      previewIndex: null,
      isResizing: props.isResizing,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }), {
      initialProps: {
        indicatorTargetIndex: 0,
        isResizing: false,
      },
    });

    rerender({ indicatorTargetIndex: 1, isResizing: false });

    expect(sequenceSpy).toHaveBeenCalled();
    expect(sequenceStart).toHaveBeenCalled();

    unmount();
    expect(sequenceStop).toHaveBeenCalled();

    sequenceSpy.mockRestore();
    timingSpy.mockRestore();
  });

  it('resets stretch scale to baseline on cleanup', () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 100, height: 40 },
    };

    const { result, rerender } = renderHook((props: {
      indicatorTargetIndex: number;
    }) => useNavigationBarIndicator({
      tabs,
      tabLayouts,
      indicatorTargetIndex: props.indicatorTargetIndex,
      previewIndex: null,
      isResizing: false,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }), {
      initialProps: {
        indicatorTargetIndex: 0,
      },
    });

    const indicatorScaleX = result.current.indicatorScaleX;
    const setValueSpy = jest.spyOn(indicatorScaleX, 'setValue');

    indicatorScaleX.setValue(1.3);
    rerender({ indicatorTargetIndex: 1 });

    expect(setValueSpy).toHaveBeenLastCalledWith(1);
  });

  it('does not stretch indicator while resizing', () => {
    const sequenceSpy = jest.spyOn(Animated, 'sequence');

    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 100, height: 40 },
    };

    renderHook(() => useNavigationBarIndicator({
      tabs,
      tabLayouts,
      indicatorTargetIndex: 1,
      previewIndex: null,
      isResizing: true,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }));

    expect(sequenceSpy).not.toHaveBeenCalled();
    sequenceSpy.mockRestore();
  });

  it('animates tab changes even when resize mode is active', () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 100, height: 40 },
    };

    const { rerender } = renderHook((props: {
      indicatorTargetIndex: number;
      isResizing: boolean;
    }) => useNavigationBarIndicator({
      tabs,
      tabLayouts,
      indicatorTargetIndex: props.indicatorTargetIndex,
      previewIndex: null,
      isResizing: props.isResizing,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }), {
      initialProps: {
        indicatorTargetIndex: 0,
        isResizing: false,
      },
    });

    rerender({ indicatorTargetIndex: 1, isResizing: true });

    const calls = (animateIndicatorToLayout as jest.Mock).mock.calls;
    const latestArgs = calls[calls.length - 1]?.[0];

    expect(latestArgs?.isResizing).toBe(false);
  });

  it('skips movement animation when target layout is unavailable', () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];

    renderHook(() => useNavigationBarIndicator({
      tabs,
      tabLayouts: { home: { x: 0, y: 0, width: 80, height: 40 } },
      indicatorTargetIndex: 1,
      previewIndex: null,
      isResizing: true,
      activeColor: '#000000',
      pressedColor: '#111111',
      duration: 160,
      easing: (value: number) => value,
    }));

    expect(animateIndicatorToLayout).not.toHaveBeenCalled();
    expect(animateIndicatorPressedProgress).toHaveBeenCalledTimes(1);
  });
});
