import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DateRangeSlider } from '../DateRangeSlider';

const selectFieldInstances: any[] = [];
jest.mock('@/components/inputs/SelectField', () => ({
  SelectField: (props: any) => {
    selectFieldInstances.push(props);
    return null;
  },
}));

const gestureCallbacks: Record<string, Function> = {};
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => children,
  GestureDetector: ({ children }: any) => children,
  Gesture: {
    Pan: () => {
      const handler: any = {};
      handler.onBegin = (cb: Function) => {
        gestureCallbacks['onBegin'] = cb;
        return handler;
      };
      handler.onUpdate = (cb: Function) => {
        gestureCallbacks['onUpdate'] = cb;
        return handler;
      };
      handler.onEnd = (cb: Function) => {
        gestureCallbacks['onEnd'] = cb;
        return handler;
      };
      return handler;
    },
  },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: any) => children,
    createAnimatedComponent: (c: any) => c,
  },
  useSharedValue: (init: any) => ({ value: init }),
  useAnimatedStyle: (_fn: any) => ({}),
  runOnJS: (fn: any) => fn,
  withTiming: (val: any) => val,
  withSpring: (val: any) => val,
}));

const MIN = { year: 2010, month: 1 };
const MAX = { year: 2024, month: 12 };
const START = { year: 2015, month: 6 };
const END = { year: 2022, month: 6 };

describe('DateRangeSlider', () => {
  beforeEach(() => {
    selectFieldInstances.length = 0;
  });

  it('renders without crashing with required props', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(getByText(/Jun 2015/)).toBeTruthy();
    expect(getByText(/Jun 2022/)).toBeTruthy();
  });

  it('renders with default min/max when not provided', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(getByText(/Jun 2015/)).toBeTruthy();
  });

  it('shows day in date label when dates include day field', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={{ year: 2015, month: 6, day: 15 }}
        endDate={{ year: 2022, month: 6, day: 20 }}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(getByText(/Jun 15, 2015/)).toBeTruthy();
    expect(getByText(/Jun 20, 2022/)).toBeTruthy();
  });

  it('opens edit panel for start side on press and shows select fields', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(selectFieldInstances).toHaveLength(0);
    fireEvent.press(getByText(/Jun 2015/));
    expect(selectFieldInstances.length).toBeGreaterThan(0);
    expect(selectFieldInstances.some((p) => p.label === 'Month')).toBe(true);
    expect(selectFieldInstances.some((p) => p.label === 'Year')).toBe(true);
  });

  it('opens edit panel for end side on press', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jun 2022/));
    expect(selectFieldInstances.some((p) => p.label === 'Month')).toBe(true);
  });

  it('calls onStartChange when year select changes', () => {
    const onStartChange = jest.fn();
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jun 2015/));
    const yearSelect = selectFieldInstances.find((p) => p.label === 'Year');
    yearSelect.onValueChange('2018');
    expect(onStartChange).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2018 }),
    );
  });

  it('calls onStartChange when month changes without day', () => {
    const onStartChange = jest.fn();
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jun 2015/));
    const monthSelect = selectFieldInstances.find((p) => p.label === 'Month');
    monthSelect.onValueChange('3');
    expect(onStartChange).toHaveBeenCalledWith(
      expect.objectContaining({ month: 3, day: undefined }),
    );
  });

  it('clamps day when month changes to shorter month', () => {
    const onStartChange = jest.fn();
    const { getByText } = render(
      <DateRangeSlider
        startDate={{ year: 2015, month: 1, day: 31 }}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jan 31, 2015/));
    const monthSelect = selectFieldInstances.find((p) => p.label === 'Month');
    monthSelect.onValueChange('2');
    expect(onStartChange).toHaveBeenCalledWith(
      expect.objectContaining({ month: 2, day: 28 }),
    );
  });

  it('calls onStartChange when day select set to a value', () => {
    const onStartChange = jest.fn();
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jun 2015/));
    const daySelect = selectFieldInstances.find((p) => p.label === 'Day');
    daySelect.onValueChange('10');
    expect(onStartChange).toHaveBeenCalledWith(
      expect.objectContaining({ day: 10 }),
    );
  });

  it('closes edit panel when same side pressed twice', () => {
    const { getByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jun 2015/));
    expect(selectFieldInstances.length).toBeGreaterThan(0);
    selectFieldInstances.length = 0;
    fireEvent.press(getByText(/Jun 2015/));
    expect(selectFieldInstances).toHaveLength(0);
  });

  it('invokes gesture callbacks without crashing', () => {
    const onStartChange = jest.fn();
    render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    if (gestureCallbacks.onBegin) gestureCallbacks.onBegin();
    if (gestureCallbacks.onUpdate)
      gestureCallbacks.onUpdate({ translationX: 50 });
    if (gestureCallbacks.onEnd) gestureCallbacks.onEnd();
  });
});
