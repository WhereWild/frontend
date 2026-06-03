// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { PolarDensityChart } from '../PolarDensityChart';

const mockReactLocal = React;
const mockRNView = View;
const mockRNText = Text;

jest.mock('react-native-svg', () => {
  const MockPassthrough = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, null, children);

  // Render SVG text content as a real RN Text so screen.getByText works.
  const MockSvgText = ({
    children,
    fill,
  }: {
    children?: React.ReactNode;
    fill?: string;
    [key: string]: unknown;
  }) =>
    mockReactLocal.createElement(
      mockRNText,
      { testID: fill === '#F59E0B' ? 'pin-label-text' : undefined },
      children,
    );

  // Expose stroke so tests can query for the pin line.
  const MockLine = ({
    stroke,
    strokeDasharray,
  }: {
    stroke?: string;
    strokeDasharray?: string;
    [key: string]: unknown;
  }) =>
    mockReactLocal.createElement(mockRNView, {
      testID: stroke === '#F59E0B' ? 'pin-line' : `line-${stroke ?? 'default'}`,
      accessibilityLabel: strokeDasharray ?? '',
    });

  return {
    __esModule: true,
    default: MockPassthrough,
    Circle: MockPassthrough,
    Line: MockLine,
    Path: MockPassthrough,
    Text: MockSvgText,
  };
});

const validCurve = {
  points: [0, 45, 90, 135, 180, 225, 270, 315, 360],
  density: [0.1, 0.3, 0.8, 0.5, 0.2, 0.4, 0.7, 0.3, 0.1],
};

describe('PolarDensityChart', () => {
  it('renders empty state when curve is null', () => {
    render(
      <PolarDensityChart
        curve={null}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );
    expect(screen.getByText('Density curve unavailable.')).toBeTruthy();
  });

  it('renders empty state when curve is undefined', () => {
    render(
      <PolarDensityChart
        curve={undefined}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );
    expect(screen.getByText('Density curve unavailable.')).toBeTruthy();
  });

  it('renders empty state when all density values are zero', () => {
    render(
      <PolarDensityChart
        curve={{ points: [0, 90, 180, 270], density: [0, 0, 0, 0] }}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );
    expect(screen.getByText('Density curve unavailable.')).toBeTruthy();
  });

  it('renders chart wrapper when curve has non-zero density', () => {
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );
    expect(screen.queryByText('Density curve unavailable.')).toBeNull();
    expect(UNSAFE_root).toBeTruthy();
  });

  it('calls onSelectionChange with arc range when user drags', () => {
    const onSelectionChange = jest.fn();
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const wrapper = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' && node.props?.onStartShouldSetResponder,
    )[0];

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 130 },
    });
    fireEvent(wrapper, 'responderMove', {
      nativeEvent: { locationX: 200, locationY: 130 },
    });

    const rangeCalls = onSelectionChange.mock.calls.filter(
      (call) =>
        call[0] &&
        typeof call[0].start === 'number' &&
        typeof call[0].end === 'number',
    );
    expect(rangeCalls.length).toBeGreaterThan(0);
  });

  it('clears selection on release when no drag has occurred (tap)', () => {
    const onSelectionChange = jest.fn();
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        selection={{ start: 45, end: 135 }}
        onSelectionChange={onSelectionChange}
      />,
    );

    const wrapper = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' && node.props?.onStartShouldSetResponder,
    )[0];

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 50 },
    });
    fireEvent(wrapper, 'responderRelease', { nativeEvent: {} });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('clears selection on terminate when no drag has occurred', () => {
    const onSelectionChange = jest.fn();
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const wrapper = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' && node.props?.onStartShouldSetResponder,
    )[0];

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 50 },
    });
    fireEvent(wrapper, 'responderTerminate', { nativeEvent: {} });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('does not clear selection on release after a drag has moved', () => {
    const onSelectionChange = jest.fn();
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const wrapper = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' && node.props?.onStartShouldSetResponder,
    )[0];

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 50 },
    });
    fireEvent(wrapper, 'responderMove', {
      nativeEvent: { locationX: 200, locationY: 130 },
    });
    onSelectionChange.mockClear();
    fireEvent(wrapper, 'responderRelease', { nativeEvent: {} });

    const nullCalls = onSelectionChange.mock.calls.filter(
      (call) => call[0] === null,
    );
    expect(nullCalls).toHaveLength(0);
  });

  it('resets drag state after release so a follow-up tap clears selection', () => {
    const onSelectionChange = jest.fn();
    const { UNSAFE_root } = render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const wrapper = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' && node.props?.onStartShouldSetResponder,
    )[0];

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 50 },
    });
    fireEvent(wrapper, 'responderMove', {
      nativeEvent: { locationX: 200, locationY: 130 },
    });
    fireEvent(wrapper, 'responderRelease', { nativeEvent: {} });

    onSelectionChange.mockClear();

    fireEvent(wrapper, 'responderGrant', {
      nativeEvent: { locationX: 130, locationY: 50 },
    });
    fireEvent(wrapper, 'responderRelease', { nativeEvent: {} });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('renders amber pin line and bearing label when pinValue is provided', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={90}
        pinLoading={false}
      />,
    );

    expect(screen.getByTestId('pin-line')).toBeTruthy();
    expect(screen.getByText('90°')).toBeTruthy();
  });

  it('rounds fractional pinValue in the label', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={182.7}
        pinLoading={false}
      />,
    );

    expect(screen.getByText('183°')).toBeTruthy();
  });

  it('renders no pin line when pinLoading is true', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={90}
        pinLoading={true}
      />,
    );

    expect(screen.queryByTestId('pin-line')).toBeNull();
    expect(screen.queryByText('90°')).toBeNull();
  });

  it('renders no pin line when pinValue is null', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={null}
        pinLoading={false}
      />,
    );

    expect(screen.queryByTestId('pin-line')).toBeNull();
  });

  it('renders no pin when neither pinValue nor pinLoading is provided', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );

    expect(screen.queryByTestId('pin-line')).toBeNull();
  });

  it('hides a cardinal label when pin is within 5° of it', () => {
    // pin at 3° — within 5° of North (0°)
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={3}
        pinLoading={false}
      />,
    );

    expect(screen.queryByText('N')).toBeNull();
    // Other cardinals should still show
    expect(screen.getByText('E')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
  });

  it('hides a cardinal label when pin is within 5° on the other side (357°)', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={357}
        pinLoading={false}
      />,
    );

    expect(screen.queryByText('N')).toBeNull();
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('shows all cardinals when pin is exactly 5° from one (boundary)', () => {
    // 5° is not strictly less than 5 — boundary is ≤ 5, so 5° hides, 6° shows
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
        pinValue={6}
        pinLoading={false}
      />,
    );

    expect(screen.getByText('N')).toBeTruthy();
  });

  it('does not hide any cardinal when no pin is set', () => {
    render(
      <PolarDensityChart
        curve={validCurve}
        fillColor='#000'
        lineColor='#000'
        guideColor='#999'
      />,
    );

    expect(screen.getByText('N')).toBeTruthy();
    expect(screen.getByText('E')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
  });
});
