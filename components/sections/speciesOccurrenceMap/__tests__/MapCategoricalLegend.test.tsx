// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, fireEvent, render } from '@testing-library/react-native';
import { MapCategoricalLegend } from '../MapCategoricalLegend';
import type { LegendClass } from '@/data/types';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('@/hooks/useResponsive');
const mockUseResponsive = useResponsive as jest.Mock;

const CLASSES: LegendClass[] = [
  { id: 1, name: 'Forest', color: '#00ff00' },
  { id: 2, name: 'Water', color: '#0000ff' },
  { id: 3, name: 'Urban', color: '#ff0000' },
];

describe('MapCategoricalLegend multi-select', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      rootFontSize: 16,
    });
  });

  it('reports each clicked class id independently, letting the caller build up a multi-class selection', () => {
    const onClassClick = jest.fn();
    const { getByText } = render(
      <MapCategoricalLegend
        classes={CLASSES}
        selectedClassIds={[1]}
        onClassClick={onClassClick}
      />,
    );

    fireEvent.press(getByText('Water'));
    fireEvent.press(getByText('Urban'));

    expect(onClassClick).toHaveBeenNthCalledWith(1, 2);
    expect(onClassClick).toHaveBeenNthCalledWith(2, 3);
  });

  it('treats an empty selection the same as no filter (nothing marked selected)', () => {
    const { getByText, queryByTestId } = render(
      <MapCategoricalLegend
        classes={CLASSES}
        selectedClassIds={[]}
        onClassClick={jest.fn()}
      />,
    );
    expect(getByText('Forest')).toBeTruthy();
    expect(queryByTestId('nonexistent')).toBeNull();
  });
});

describe('MapCategoricalLegend on phone (long-press-to-select, tap-to-collapse)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      rootFontSize: 16,
    });
  });

  it('does not select a class on a plain tap — a row Pressable that ate every tap made the legend nearly impossible to collapse', () => {
    const onClassClick = jest.fn();
    const { getByText, getByTestId } = render(
      <MapCategoricalLegend
        classes={CLASSES}
        selectedClassIds={[]}
        onClassClick={onClassClick}
      />,
    );
    // Starts collapsed on phone — expand it first so the row is reachable.
    act(() => {
      fireEvent.press(getByTestId('map-categorical-legend'));
    });
    act(() => {
      fireEvent.press(getByText('Water'));
    });
    expect(onClassClick).not.toHaveBeenCalled();
  });

  it('selects a class on a long-press', () => {
    const onClassClick = jest.fn();
    const { getByText, getByTestId } = render(
      <MapCategoricalLegend
        classes={CLASSES}
        selectedClassIds={[]}
        onClassClick={onClassClick}
      />,
    );
    act(() => {
      fireEvent.press(getByTestId('map-categorical-legend'));
    });
    act(() => {
      fireEvent(getByText('Water'), 'longPress');
    });
    expect(onClassClick).toHaveBeenCalledWith(2);
  });
});
