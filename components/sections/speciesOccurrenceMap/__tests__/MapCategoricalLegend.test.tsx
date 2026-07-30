// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render } from '@testing-library/react-native';
import { MapCategoricalLegend } from '../MapCategoricalLegend';
import type { LegendClass } from '@/data/types';

const CLASSES: LegendClass[] = [
  { id: 1, name: 'Forest', color: '#00ff00' },
  { id: 2, name: 'Water', color: '#0000ff' },
  { id: 3, name: 'Urban', color: '#ff0000' },
];

describe('MapCategoricalLegend multi-select', () => {
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
