// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapCbModePicker } from '../speciesOccurrenceMap/MapCbModePicker';
import type { LegendClass } from '@/data/types';

const sampleClasses: LegendClass[] = [
  { id: 1, name: 'Forest', color: '#228B22' },
  { id: 2, name: 'Desert', color: '#C2B280' },
  { id: 3, name: 'Water', color: '#1E90FF' },
];

describe('MapCbModePicker', () => {
  it('renders all mode options', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapCbModePicker
        selected={null}
        onChange={onChange}
        topClasses={sampleClasses}
        variableId='kg2'
      />,
    );
    expect(getAllByRole('radio').length).toBe(3);
  });

  it('calls onChange when a mode is pressed', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapCbModePicker
        selected={null}
        onChange={onChange}
        topClasses={sampleClasses}
        variableId='kg2'
      />,
    );
    fireEvent.press(getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith('colorblind');
  });

  it('renders with null (default) mode selected', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapCbModePicker
        selected={null}
        onChange={onChange}
        topClasses={sampleClasses}
        variableId='kg2'
      />,
    );
    const selected = getAllByRole('radio').filter(
      (r) => r.props.accessibilityState?.selected,
    );
    expect(selected.length).toBe(1);
  });

  it('renders with colorblind mode selected', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected='colorblind'
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with achromatopsia mode selected', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected='achromatopsia'
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with shapesEnabled', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected={null}
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
          shapesEnabled
        />,
      ),
    ).not.toThrow();
  });

  it('renders with markerOutlineEnabled', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected={null}
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
          markerOutlineEnabled
        />,
      ),
    ).not.toThrow();
  });

  it('renders with empty topClasses', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected={null}
          onChange={onChange}
          topClasses={[]}
          variableId='kg2'
        />,
      ),
    ).not.toThrow();
  });

  it('renders circular mode (native path)', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected={null}
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
          isCircular
        />,
      ),
    ).not.toThrow();
  });

  it('renders circular mode with achromatopsia (shows shapes)', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCbModePicker
          selected='achromatopsia'
          onChange={onChange}
          topClasses={sampleClasses}
          variableId='kg2'
          isCircular
        />,
      ),
    ).not.toThrow();
  });
});
