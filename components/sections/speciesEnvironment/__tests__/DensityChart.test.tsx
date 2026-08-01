// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DensityChart } from '../DensityChart';

const mockReactLocal = React;
const mockRNView = View;

jest.mock('react-native-svg', () => {
  const Mock = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, null, children);
  return {
    __esModule: true,
    default: Mock,
    Path: Mock,
    Defs: Mock,
    ClipPath: Mock,
    Rect: Mock,
  };
});

const getNonNullRangeCalls = (mockFn: jest.Mock) =>
  mockFn.mock.calls.filter(
    (call) =>
      call[0] &&
      typeof call[0].start === 'number' &&
      typeof call[0].end === 'number',
  );

const getLabelContainerStyle = (label: string) => {
  let current = screen.getByText(label) as ReactTestInstance | null;

  while (current) {
    const style = current.props.style;
    const resolvedStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    if (
      resolvedStyle &&
      typeof resolvedStyle === 'object' &&
      'left' in resolvedStyle
    ) {
      return resolvedStyle as {
        left?: string;
        marginLeft?: number;
        width?: number;
      };
    }

    current = current.parent;
  }

  throw new Error(`Could not find positioned container for label: ${label}`);
};

const getPinImageContainerStyle = () => {
  let current = screen.getByTestId(
    'density-chart-pin-image',
  ) as ReactTestInstance | null;

  while (current) {
    const style = current.props.style;
    const resolvedStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    if (
      resolvedStyle &&
      typeof resolvedStyle === 'object' &&
      'left' in resolvedStyle
    ) {
      return resolvedStyle as {
        left?: string;
        opacity?: number;
      };
    }

    current = current.parent;
  }

  throw new Error('Could not find positioned container for density pin image');
};

describe('DensityChart', () => {
  it('renders empty state when curve is missing', () => {
    render(
      <DensityChart
        curve={null}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={null}
        selections={[]}
      />,
    );

    expect(screen.getByText('Density curve unavailable.')).toBeTruthy();
  });

  it('renders chart and emits selection range from responder events', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 10, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const chartSurface = getByTestId('density-chart-surface');
    const responderNode = getByTestId('density-chart-responder');

    fireEvent(chartSurface, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 20 },
    });
    fireEvent(responderNode, 'responderMove', {
      nativeEvent: { locationX: 180 },
    });
    fireEvent(responderNode, 'responderRelease', {
      nativeEvent: { locationX: 180 },
    });

    expect(onSelectionChange).toHaveBeenCalled();
    const rangeCalls = getNonNullRangeCalls(onSelectionChange);
    expect(rangeCalls.length).toBeGreaterThan(0);
  });

  it('clears selection when release occurs without drag origin', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [1, 0.5] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'responderRelease', {
      nativeEvent: { locationX: 50 },
    });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('clears selection on terminate when no drag is in progress', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [0.4, 0.4] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'responderTerminate');
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('clears selection when drag starts but does not move', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [0.4, 0.4] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const chartSurface = getByTestId('density-chart-surface');
    const responderNode = getByTestId('density-chart-responder');

    fireEvent(chartSurface, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 80 },
    });
    fireEvent(responderNode, 'responderRelease', {
      nativeEvent: { locationX: 80 },
    });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('handles responder terminate and renders labels only for provided summary metrics', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: null, max: 10 }}
        selections={[{ start: 6, end: 6 }]}
        onSelectionChange={onSelectionChange}
      />,
    );

    expect(queryByText('mean')).toBeNull();
    expect(queryByText('min')).toBeTruthy();
    expect(queryByText('max')).toBeTruthy();

    const chartSurface = getByTestId('density-chart-surface');
    const responderNode = getByTestId('density-chart-responder');

    fireEvent(chartSurface, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 20 },
    });
    fireEvent(responderNode, 'responderTerminate', {
      nativeEvent: { locationX: 20 },
    });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('preserves the last dragged range when responder terminates mid-drag', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const chartSurface = getByTestId('density-chart-surface');
    const responderNode = getByTestId('density-chart-responder');

    fireEvent(chartSurface, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 20 },
    });
    fireEvent(responderNode, 'responderMove', {
      nativeEvent: { locationX: 120 },
    });
    fireEvent(responderNode, 'responderTerminate', {
      nativeEvent: { locationX: 130 },
    });

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      { start: 1, end: 6 },
      { additive: false, sessionId: 1, final: true },
    );
  });

  it('rejects responder termination once dragging is active', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [0.4, 0.4] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const chartSurface = getByTestId('density-chart-surface');
    const responderNode = getByTestId('density-chart-responder');

    expect(
      responderNode.props.onResponderTerminationRequest({
        nativeEvent: { locationX: 10 },
      }),
    ).toBe(true);

    fireEvent(chartSurface, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 20 },
    });
    fireEvent(responderNode, 'responderMove', {
      nativeEvent: { locationX: 80 },
    });

    expect(
      responderNode.props.onResponderTerminationRequest({
        nativeEvent: { locationX: 80 },
      }),
    ).toBe(false);
  });

  it('renders highlighted selection overlay when selection has width and formats invalid summary values', () => {
    render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: Number.NaN, mean: 5, max: 10 }}
        selections={[{ start: 1, end: 9 }]}
      />,
    );

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('mean')).toBeTruthy();
  });

  it('ignores drag events when layout width is unavailable', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [0.2, 0.4] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 10 },
    });
    fireEvent(responderNode, 'responderMove', {
      nativeEvent: { locationX: 30 },
    });
    fireEvent(responderNode, 'responderRelease', {
      nativeEvent: { locationX: 30 },
    });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('ignores move updates when layout becomes unavailable after drag start', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(responderNode, 'responderGrant', {
      nativeEvent: { locationX: 20 },
    });
    fireEvent(responderNode, 'layout', {
      nativeEvent: { layout: { width: 0 } },
    });
    fireEvent(responderNode, 'responderMove', {
      nativeEvent: { locationX: 180 },
    });
    fireEvent(responderNode, 'responderRelease', {
      nativeEvent: { locationX: 180 },
    });

    expect(getNonNullRangeCalls(onSelectionChange)).toHaveLength(0);
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('does not render a selected pin label while pin data is loading', () => {
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={5}
        pinLoading
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });

    expect(queryByText('Selected')).toBeNull();
    expect(getPinImageContainerStyle()).toMatchObject({
      opacity: 0,
      left: '0%',
    });
  });

  it('renders a selected pin label for zero-span curves when edge labels are absent', () => {
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [1, 1], density: [0.3, 0.6] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={null}
        selections={[]}
        pinValue={1}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });

    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('1.0')).toBeTruthy();
  });

  it('hides the selected pin label when it overlaps the min label', () => {
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={0.2}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });

    expect(queryByText('Selected')).toBeNull();
  });

  it('hides the selected pin label when it overlaps the max label', () => {
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={9.8}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });

    expect(queryByText('Selected')).toBeNull();
  });

  it('renders the selected pin label when pin and mean overlap after layout', () => {
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={5.2}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });

    const meanStyle = getLabelContainerStyle('mean');
    const pinStyle = getLabelContainerStyle('Selected');
    const pinImageStyle = getPinImageContainerStyle();

    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('5.2')).toBeTruthy();
    expect(pinImageStyle).toMatchObject({ opacity: 1, left: '52%' });
    expect(parseFloat(meanStyle.left ?? '0')).toBeLessThan(50);
    expect(parseFloat(pinStyle.left ?? '0')).toBeGreaterThan(52);
  });

  it('renders the selected pin label when pin overlaps mean from the opposite side', () => {
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={4.8}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });

    const meanStyle = getLabelContainerStyle('mean');
    const pinStyle = getLabelContainerStyle('Selected');

    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(parseFloat(meanStyle.left ?? '0')).toBeGreaterThan(50);
    expect(parseFloat(pinStyle.left ?? '0')).toBeLessThan(48);
  });

  it('shows an out-of-range warning and hides the selected pin when the value is above the species range', () => {
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={12}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });

    expect(
      screen.getByText(
        "Location value (12.0) is above this species' observed range",
      ),
    ).toBeTruthy();
    expect(queryByText('Selected')).toBeNull();
    expect(getPinImageContainerStyle()).toMatchObject({
      opacity: 0,
      left: '0%',
    });
  });

  it('shows an out-of-range warning and hides the selected pin when the value is below the species range', () => {
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 3, min: 0, mean: 5, max: 10 }}
        selections={[]}
        pinValue={-1}
        pinLoading={false}
      />,
    );

    fireEvent(getByTestId('density-chart-responder'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });

    expect(
      screen.getByText(
        "Location value (-1.0) is below this species' observed range",
      ),
    ).toBeTruthy();
    expect(queryByText('Selected')).toBeNull();
    expect(getPinImageContainerStyle()).toMatchObject({
      opacity: 0,
      left: '0%',
    });
  });

  it('handles zero-span and zero-density curves', () => {
    render(
      <DensityChart
        curve={{ points: [1, 1], density: [0, 0] }}
        lineColor='#000'
        fillColor='#000'
        baselineColor='#000'
        summary={{ count: 2, min: 1, mean: 1, max: 1 }}
        selections={[]}
      />,
    );

    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByText('mean')).toBeTruthy();
    expect(screen.getByText('max')).toBeTruthy();
  });

  describe('discrete histogram mode', () => {
    const discreteCurve = {
      points: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      density: [0.1, 0.2, 0.4, 0.8, 1.0, 0.8, 0.4, 0.2, 0.1, 0.05],
    };

    it('renders without crashing in discrete mode', () => {
      render(
        <DensityChart
          curve={discreteCurve}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
        />,
      );
      expect(screen.getByTestId('density-chart-surface')).toBeTruthy();
    });

    it('emits bar domain bounds with displayStart/displayEnd on click', () => {
      const onSelectionChange = jest.fn();
      const { getByTestId } = render(
        <DensityChart
          curve={discreteCurve}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
          onSelectionChange={onSelectionChange}
        />,
      );

      const chartSurface = getByTestId('density-chart-surface');
      const responderNode = getByTestId('density-chart-responder');

      fireEvent(chartSurface, 'layout', {
        nativeEvent: { layout: { width: 300 } },
      });
      fireEvent(responderNode, 'responderGrant', {
        nativeEvent: { locationX: 150 },
      });
      fireEvent(responderNode, 'responderRelease', {
        nativeEvent: { locationX: 150 },
      });

      expect(onSelectionChange).toHaveBeenCalled();
      const call = onSelectionChange.mock.calls[0][0];
      expect(call).not.toBeNull();
      expect(typeof call.start).toBe('number');
      expect(typeof call.end).toBe('number');
    });

    it('clears selection on terminate without drag in discrete mode', () => {
      const onSelectionChange = jest.fn();
      const { getByTestId } = render(
        <DensityChart
          curve={discreteCurve}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
          onSelectionChange={onSelectionChange}
        />,
      );

      const responderNode = getByTestId('density-chart-responder');
      fireEvent(responderNode, 'responderTerminate');

      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('does not emit on responderMove in discrete mode', () => {
      const onSelectionChange = jest.fn();
      const { getByTestId } = render(
        <DensityChart
          curve={discreteCurve}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
          onSelectionChange={onSelectionChange}
        />,
      );

      const chartSurface = getByTestId('density-chart-surface');
      const responderNode = getByTestId('density-chart-responder');

      fireEvent(chartSurface, 'layout', {
        nativeEvent: { layout: { width: 300 } },
      });
      fireEvent(responderNode, 'responderGrant', {
        nativeEvent: { locationX: 50 },
      });
      fireEvent(responderNode, 'responderMove', {
        nativeEvent: { locationX: 200 },
      });

      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('shows pin-in-unobserved-bin warning when pinValue has no matching bar', () => {
      render(
        <DensityChart
          curve={{ points: [5, 6, 7], density: [0.5, 1.0, 0.5] }}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
          summary={{ count: 10, min: 0, mean: 5, max: 10 }}
          pinValue={0.1}
          pinLoading={false}
        />,
      );
      expect(screen.getByText(/has no observed occurrences/)).toBeTruthy();
    });

    it('does not render pin image in discrete mode', () => {
      render(
        <DensityChart
          curve={discreteCurve}
          lineColor='#00ff00'
          fillColor='#00ff00'
          baselineColor='#000'
          selections={[]}
          isDiscrete
          summary={{ count: 10, min: 0, mean: 5, max: 9 }}
          pinValue={5}
          pinLoading={false}
        />,
      );
      expect(screen.queryByTestId('density-chart-pin-image')).toBeNull();
    });
  });
});
