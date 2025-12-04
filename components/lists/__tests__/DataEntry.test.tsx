import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DataEntry, __DATA_ENTRY_TESTING__ } from '../DataEntry';

const MAX_GRAPH_HEIGHT = Size.space['8000'];
const MIN_GRAPH_HEIGHT = Size.space['1600'];

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('DataEntry', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  const elevationSummaryLabel = 'Average elevation: 2000 m';
  const precipitationSummaryLabel = 'Average precipitation: 39.4 cm';
  const expandHint = 'Will expand to reveal additional details';
  const collapseHint = 'Will collapse additional details';

  it('toggles expansion state and renders details', () => {
    const handleToggle = jest.fn();

    render(
      <DataEntry
        dataName="Average elevation"
        dataPoint="2000 m"
        details={[{ label: 'Detail name', value: 'data point' }]}
        showGraph={false}
        onToggle={handleToggle}
      />,
    );

    expect(screen.queryByText('Detail name: data point')).toBeNull();
    expect(screen.getByHintText(expandHint)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(elevationSummaryLabel));
    expect(screen.getByText('Detail name: data point')).toBeTruthy();
    expect(handleToggle).toHaveBeenLastCalledWith(true);

    expect(screen.getByHintText(collapseHint)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(elevationSummaryLabel));
    expect(handleToggle).toHaveBeenLastCalledWith(false);
  });

  it('renders a static row when not expandable', () => {
    render(
      <DataEntry
        dataName="Average elevation"
        dataPoint="2000 m"
        details={[]}
      />,
    );

    expect(screen.getByText(elevationSummaryLabel)).toBeTruthy();
    expect(screen.queryByLabelText(elevationSummaryLabel)).toBeNull();
    expect(screen.queryByTestId('data-entry-graph')).toBeNull();
  });

  it('hides the expand affordance when expandable is false', () => {
    render(
      <DataEntry
        dataName="Average precipitation"
        dataPoint="39.4 cm"
        details={[{ label: 'Detail name', value: 'data point' }]}
        expandable={false}
      />,
    );

    expect(screen.getByText(precipitationSummaryLabel)).toBeTruthy();
    expect(screen.queryByLabelText(precipitationSummaryLabel)).toBeNull();
  });

  it('still renders details when expandable is false', () => {
    render(
      <DataEntry
        dataName="Average precipitation"
        dataPoint="39.4 cm"
        details={[{ label: 'Detail name', value: 'data point' }]}
        expandable={false}
      />,
    );

    expect(screen.getByText('Detail name: data point')).toBeTruthy();
    expect(screen.getByTestId('data-entry-graph')).toBeTruthy();
  });

  it('ignores toggle attempts when the row is not expandable', () => {
    const onToggle = jest.fn();
    // We capture the memoized toggle function by spying on useCallback so we can call it directly.
    // The explicit SpyInstance typing keeps TS from widening to Function and complaining.
    const useCallbackSpy = jest.spyOn(React, 'useCallback') as jest.SpyInstance<
      ReturnType<typeof React.useCallback>,
      Parameters<typeof React.useCallback>
    >;
    let capturedToggle: (() => void) | undefined;

    try {
      // Spy on the internal toggle callback so we can invoke it directly without relying on UI interactions.
      // This keeps the test laser-focused on the guard clause that should bail when the row is not expandable.
      useCallbackSpy.mockImplementation((fn, deps) => {
        capturedToggle = fn as () => void;
        return fn;
      });

      render(
        <DataEntry
          dataName="Average elevation"
          dataPoint="2000 m"
          details={[]}
          onToggle={onToggle}
        />,
      );

      expect(typeof capturedToggle).toBe('function');
      capturedToggle?.();
      expect(onToggle).not.toHaveBeenCalled();
    } finally {
      useCallbackSpy.mockRestore();
    }
  });

  it('collapses again when entries become expandable later', () => {
    const { rerender } = render(
      <DataEntry dataName="Average elevation" dataPoint="2000 m" details={[]} />,
    );

    expect(screen.queryByLabelText(elevationSummaryLabel)).toBeNull();

    rerender(
      <DataEntry
        dataName="Average elevation"
        dataPoint="2000 m"
        details={[{ label: 'Detail name', value: 'data point' }]}
      />,
    );

    expect(screen.getByLabelText(elevationSummaryLabel)).toBeTruthy();
    expect(screen.queryByText('Detail name: data point')).toBeNull();
  });

  it('renders a fixed-height placeholder when expanded and hides it when showGraph is false', () => {
    const details = [{ label: 'Detail name', value: 'data point' }];
    const { rerender } = render(
      <DataEntry dataName="Average elevation" dataPoint="2000 m" details={details} />,
    );

    expect(screen.queryByTestId('data-entry-graph')).toBeNull();
    fireEvent.press(screen.getByLabelText(elevationSummaryLabel));
    const placeholder = screen.getByTestId('data-entry-graph');
    const flattened = StyleSheet.flatten(placeholder.props.style);
    expect(flattened.height).toBe(MAX_GRAPH_HEIGHT);
    expect(flattened.minHeight).toBe(MIN_GRAPH_HEIGHT);
    expect(flattened.maxHeight).toBe(MAX_GRAPH_HEIGHT);

    rerender(
      <DataEntry
        dataName="Average elevation"
        dataPoint="2000 m"
        showGraph={false}
        details={details}
      />,
    );
    expect(screen.queryByTestId('data-entry-graph')).toBeNull();
  });

  it('renders custom graph content when provided', () => {
    render(
      <DataEntry
        dataName="Average precipitation"
        dataPoint="39.4 cm"
        details={[{ label: 'Detail name', value: 'data point' }]}
        graph={<View testID="custom-graph" />}
      />,
    );

    fireEvent.press(screen.getByLabelText(precipitationSummaryLabel));

    expect(screen.getByTestId('custom-graph')).toBeTruthy();
  });

  it('maps pressed and hovered states to the secondary palette', () => {
    const palette = Colors.dark;

    expect(
      __DATA_ENTRY_TESTING__.resolveLabelRowBackground(palette, {
        hovered: false,
        pressed: true,
      }),
    ).toBe(palette.background.default.secondaryPressed);

    expect(
      __DATA_ENTRY_TESTING__.resolveLabelRowBackground(palette, {
        hovered: true,
        pressed: false,
      }),
    ).toBe(palette.background.default.secondaryHover);

    expect(
      __DATA_ENTRY_TESTING__.resolveLabelRowBackground(palette, {
        hovered: false,
        pressed: false,
      }),
    ).toBe('transparent');
  });

  it('applies light mode palette tokens when overridden to light mode', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(
      <DataEntry
        dataName="Average elevation"
        dataPoint="2000 m"
        details={[{ label: 'Detail name', value: 'data point' }]}
      />,
    );

    fireEvent.press(screen.getByLabelText(elevationSummaryLabel));

    const placeholder = screen.getByTestId('data-entry-graph-placeholder');
    const placeholderStyles = StyleSheet.flatten(placeholder.props.style);
    expect(placeholderStyles.backgroundColor).toBe(
      Colors.light.background.default.tertiary,
    );
  });
});
