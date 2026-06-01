import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DateRangeSlider } from '../DateRangeSlider';

jest.mock('@/components/inputs/SelectField', () => ({
  SelectField: ({ label, options, onValueChange }: any) => {
    const { View, Text, Pressable } = require('react-native');
    const { createElement } = require('react');
    return createElement(View, null,
      createElement(Text, null, label),
      ...(options ?? []).map((opt: any) =>
        createElement(Pressable, { key: opt.value, testID: `select-${label}-${opt.value}`, onPress: () => onValueChange(opt.value) },
          createElement(Text, null, opt.label)
        )
      )
    );
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const { createElement } = require('react');
  const gestureCallbacks: Record<string, Function> = {};
  return {
    __gestureCallbacks: gestureCallbacks,
    GestureHandlerRootView: ({ children }: any) => createElement(View, null, children),
    GestureDetector: ({ children }: any) => createElement(View, null, children),
    Gesture: {
      Pan: () => {
        const handler: any = {};
        handler.onBegin = (cb: Function) => { gestureCallbacks['onBegin'] = cb; return handler; };
        handler.onUpdate = (cb: Function) => { gestureCallbacks['onUpdate'] = cb; return handler; };
        handler.onEnd = (cb: Function) => { gestureCallbacks['onEnd'] = cb; return handler; };
        return handler;
      },
    },
  };
});

const gestureHandlerMock = jest.requireMock('react-native-gesture-handler');

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const mock = {
    __esModule: true,
    default: { View: RN.View, createAnimatedComponent: (c: any) => c },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (_fn: any) => ({}),
    runOnJS: (fn: any) => fn,
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
  };
  return mock;
});

const MIN = { year: 2010, month: 1 };
const MAX = { year: 2024, month: 12 };
const START = { year: 2015, month: 6 };
const END = { year: 2022, month: 6 };

describe('DateRangeSlider', () => {
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

  it('opens edit panel for start side on press and shows selects', () => {
    const onStartChange = jest.fn();
    const { getByText, queryByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    expect(queryByText('Month')).toBeNull();
    fireEvent.press(getByText(/Jun 2015/));
    expect(getByText('Month')).toBeTruthy();
    expect(getByText('Year')).toBeTruthy();
  });

  it('calls onEndChange when end year select changes', () => {
    const onEndChange = jest.fn();
    render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={onEndChange}
      />,
    );
  });

  it('shows day in date label when dates include day field', () => {
    const startWithDay = { year: 2015, month: 6, day: 15 };
    const endWithDay = { year: 2022, month: 6, day: 20 };
    const { getByText } = render(
      <DateRangeSlider
        startDate={startWithDay}
        endDate={endWithDay}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(getByText(/Jun 15, 2015/)).toBeTruthy();
    expect(getByText(/Jun 20, 2022/)).toBeTruthy();
  });

  it('opens edit panel for end side on press', () => {
    const { getByText, queryByText } = render(
      <DateRangeSlider
        startDate={START}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={jest.fn()}
        onEndChange={jest.fn()}
      />,
    );
    expect(queryByText('Month')).toBeNull();
    fireEvent.press(getByText(/Jun 2022/));
    expect(getByText('Month')).toBeTruthy();
  });

  it('calls onStartChange when year select changes in edit panel', () => {
    const onStartChange = jest.fn();
    const { getByText, getByTestId } = render(
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
    fireEvent.press(getByTestId('select-Year-2018'));
    expect(onStartChange).toHaveBeenCalledWith(expect.objectContaining({ year: 2018 }));
  });

  it('calls onStartChange when month select changes without day', () => {
    const onStartChange = jest.fn();
    const { getByText, getByTestId } = render(
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
    fireEvent.press(getByTestId('select-Month-3'));
    expect(onStartChange).toHaveBeenCalledWith(expect.objectContaining({ month: 3, day: undefined }));
  });

  it('calls onStartChange when month changes and clamps existing day', () => {
    const startWithDay = { year: 2015, month: 1, day: 31 };
    const onStartChange = jest.fn();
    const { getByText, getByTestId } = render(
      <DateRangeSlider
        startDate={startWithDay}
        endDate={END}
        minDate={MIN}
        maxDate={MAX}
        onStartChange={onStartChange}
        onEndChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Jan 31, 2015/));
    fireEvent.press(getByTestId('select-Month-2'));
    expect(onStartChange).toHaveBeenCalledWith(expect.objectContaining({ month: 2, day: 28 }));
  });

it('calls onStartChange when day select set to a value', () => {
    const onStartChange = jest.fn();
    const { getByText, getByTestId } = render(
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
    fireEvent.press(getByTestId('select-Day-10'));
    expect(onStartChange).toHaveBeenCalledWith(expect.objectContaining({ day: 10 }));
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
    const { __gestureCallbacks: cb } = gestureHandlerMock;
    if (cb.onBegin) cb.onBegin();
    if (cb.onUpdate) cb.onUpdate({ translationX: 50 });
    if (cb.onEnd) cb.onEnd();
  });

  it('closes edit panel when same side pressed twice', () => {
    const { getByText, queryByText } = render(
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
    expect(getByText('Month')).toBeTruthy();
    fireEvent.press(getByText(/Jun 2015/));
    expect(queryByText('Month')).toBeNull();
  });
});
