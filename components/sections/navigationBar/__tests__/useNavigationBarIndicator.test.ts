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
    expect(result.current.indicatorBackgroundColor).toBeTruthy();

    expect(animateIndicatorToLayout).toHaveBeenCalledTimes(1);
    expect(animateIndicatorPressedProgress).toHaveBeenCalledTimes(1);
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
