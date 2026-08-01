// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Exercises the REAL NavigationPillList (not the mock used by
// StackedCategoryBar.test.tsx) end-to-end, since the pills — not the bar
// segments — are the actual UI surface users click to select a category.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StackedCategoryBar } from '../StackedCategoryBar';

const categories = [
  { value: 'a', className: 'Forest', count: 10, fraction: 0.3 },
  { value: 'b', className: 'Grassland', count: 8, fraction: 0.25 },
  { value: 'c', className: 'Wetland', count: 7, fraction: 0.25 },
  { value: 'd', className: 'Desert', count: 5, fraction: 0.2 },
];

function StatefulHarness() {
  const [selected, setSelected] = React.useState<(number | string)[]>([]);
  const handleSelect = (
    value: number | string,
    options?: { additive?: boolean },
  ) => {
    const additive = options?.additive ?? false;
    setSelected((prev) => {
      const alreadySelected = prev.some((v) => String(v) === String(value));
      if (!alreadySelected && !additive && prev.length > 1) {
        return prev;
      }
      if (alreadySelected) {
        return prev.filter((v) => String(v) !== String(value));
      }
      return additive ? [...prev, value] : [value];
    });
  };
  return (
    <StackedCategoryBar
      categories={categories}
      selectedValues={selected}
      onSelect={handleSelect}
      descriptionColor='#333'
    />
  );
}

const isSelected = (label: string) =>
  screen.getByLabelText(label).props.accessibilityState.selected;

describe('StackedCategoryBar pill integration (real NavigationPillList)', () => {
  it('ctrl-clicking a second pill adds it to the selection instead of replacing it', () => {
    render(<StatefulHarness />);

    fireEvent.press(screen.getByLabelText('Forest'));
    fireEvent.press(screen.getByLabelText('Grassland'), {
      nativeEvent: { ctrlKey: true },
    });

    expect(isSelected('Forest')).toBe(true);
    expect(isSelected('Grassland')).toBe(true);
  });

  it('a plain click on an already-selected pill deselects it', () => {
    render(<StatefulHarness />);

    fireEvent.press(screen.getByLabelText('Forest'));
    expect(isSelected('Forest')).toBe(true);

    fireEvent.press(screen.getByLabelText('Forest'));
    expect(isSelected('Forest')).toBe(false);
  });

  it('a plain click on one of several selected pills deselects only that one, not the rest', () => {
    render(<StatefulHarness />);

    fireEvent.press(screen.getByLabelText('Forest'));
    fireEvent.press(screen.getByLabelText('Grassland'), {
      nativeEvent: { ctrlKey: true },
    });
    fireEvent.press(screen.getByLabelText('Wetland'), {
      nativeEvent: { ctrlKey: true },
    });
    expect(isSelected('Forest')).toBe(true);
    expect(isSelected('Grassland')).toBe(true);
    expect(isSelected('Wetland')).toBe(true);

    // Plain click (no ctrl) on an already-selected pill among several —
    // must NOT collapse the selection down to just this one.
    fireEvent.press(screen.getByLabelText('Grassland'));

    expect(isSelected('Forest')).toBe(true);
    expect(isSelected('Grassland')).toBe(false);
    expect(isSelected('Wetland')).toBe(true);
  });

  it('a plain click on an UNselected pill does nothing while a multi-selection is active', () => {
    render(<StatefulHarness />);

    fireEvent.press(screen.getByLabelText('Forest'));
    fireEvent.press(screen.getByLabelText('Grassland'), {
      nativeEvent: { ctrlKey: true },
    });
    expect(isSelected('Forest')).toBe(true);
    expect(isSelected('Grassland')).toBe(true);
    expect(isSelected('Desert')).toBe(false);

    // Plain click (no ctrl) on Desert, which isn't selected — with a
    // multi-selection already active, this must be a no-op, not a "start
    // fresh with just Desert" replace.
    fireEvent.press(screen.getByLabelText('Desert'));

    expect(isSelected('Forest')).toBe(true);
    expect(isSelected('Grassland')).toBe(true);
    expect(isSelected('Desert')).toBe(false);
  });

  it('ctrl-clicking an already-selected pill deselects just that one', () => {
    render(<StatefulHarness />);

    fireEvent.press(screen.getByLabelText('Forest'));
    fireEvent.press(screen.getByLabelText('Grassland'), {
      nativeEvent: { ctrlKey: true },
    });

    fireEvent.press(screen.getByLabelText('Forest'), {
      nativeEvent: { ctrlKey: true },
    });

    expect(isSelected('Forest')).toBe(false);
    expect(isSelected('Grassland')).toBe(true);
  });
});
