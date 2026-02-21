import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
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

describe('DensityChart', () => {
  it('renders empty state when curve is missing', () => {
    render(
      <DensityChart
        curve={null}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={null}
        selection={null}
      />,
    );

    expect(screen.getByText('Density curve unavailable.')).toBeTruthy();
  });

  it('renders chart and emits selection range from responder events', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 10, min: 0, mean: 5, max: 10 }}
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(responderNode, 'responderGrant', { nativeEvent: { locationX: 20 } });
    fireEvent(responderNode, 'responderMove', { nativeEvent: { locationX: 180 } });
    fireEvent(responderNode, 'responderRelease', { nativeEvent: { locationX: 180 } });

    expect(onSelectionChange).toHaveBeenCalled();
    const rangeCalls = onSelectionChange.mock.calls.filter(
      (call) => call[0] && typeof call[0].start === 'number' && typeof call[0].end === 'number',
    );
    expect(rangeCalls.length).toBeGreaterThan(0);
  });

  it('clears selection when release occurs without drag origin', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [1, 0.5] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'responderRelease', { nativeEvent: { locationX: 50 } });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('clears selection when drag starts but does not move', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId } = render(
      <DensityChart
        curve={{ points: [0, 10], density: [0.4, 0.4] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(responderNode, 'responderGrant', { nativeEvent: { locationX: 80 } });
    fireEvent(responderNode, 'responderRelease', { nativeEvent: { locationX: 80 } });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('handles responder terminate and renders labels only for provided summary metrics', () => {
    const onSelectionChange = jest.fn();
    const { getByTestId, queryByText } = render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 3, min: 0, mean: null, max: 10 }}
        selection={{ start: 6, end: 6 }}
        onSelectionChange={onSelectionChange}
      />,
    );

    expect(queryByText('mean')).toBeNull();
    expect(queryByText('min')).toBeTruthy();
    expect(queryByText('max')).toBeTruthy();

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(responderNode, 'responderGrant', { nativeEvent: { locationX: 20 } });
    fireEvent(responderNode, 'responderTerminate', { nativeEvent: { locationX: 20 } });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('renders highlighted selection overlay when selection has width and formats invalid summary values', () => {
    render(
      <DensityChart
        curve={{ points: [0, 5, 10], density: [0.1, 0.9, 0.1] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 3, min: Number.NaN, mean: 5, max: 10 }}
        selection={{ start: 1, end: 9 }}
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
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 2, min: 0, mean: 5, max: 10 }}
        selection={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    const responderNode = getByTestId('density-chart-responder');

    fireEvent(responderNode, 'responderGrant', { nativeEvent: { locationX: 10 } });
    fireEvent(responderNode, 'responderMove', { nativeEvent: { locationX: 30 } });
    fireEvent(responderNode, 'responderRelease', { nativeEvent: { locationX: 30 } });

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('handles zero-span and zero-density curves', () => {
    render(
      <DensityChart
        curve={{ points: [1, 1], density: [0, 0] }}
        lineColor="#000"
        fillColor="#000"
        baselineColor="#000"
        summary={{ count: 2, min: 1, mean: 1, max: 1 }}
        selection={null}
      />,
    );

    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByText('mean')).toBeTruthy();
    expect(screen.getByText('max')).toBeTruthy();
  });
});
