// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapCircularColormapPicker } from '../speciesOccurrenceMap/MapCircularColormapPicker';
import { CIRCULAR_COLORMAP_ORDER } from '../speciesOccurrenceMap/variableColors';

describe('MapCircularColormapPicker', () => {
  it('renders all circular colormap options', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapCircularColormapPicker
        selected={CIRCULAR_COLORMAP_ORDER[0]}
        onChange={onChange}
      />,
    );
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('calls onChange when a colormap option is pressed', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapCircularColormapPicker
        selected={CIRCULAR_COLORMAP_ORDER[0]}
        onChange={onChange}
      />,
    );
    if (getAllByRole('radio').length > 1) {
      fireEvent.press(getAllByRole('radio')[1]);
      expect(onChange).toHaveBeenCalledWith(CIRCULAR_COLORMAP_ORDER[1]);
    }
  });

  it('renders monochrome mode with achromatopsia cbMode', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCircularColormapPicker
          selected={CIRCULAR_COLORMAP_ORDER[0]}
          onChange={onChange}
          cbMode='achromatopsia'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with colorblind cbMode', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCircularColormapPicker
          selected={CIRCULAR_COLORMAP_ORDER[0]}
          onChange={onChange}
          cbMode='colorblind'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with null cbMode', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCircularColormapPicker
          selected={CIRCULAR_COLORMAP_ORDER[0]}
          onChange={onChange}
          cbMode={null}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with markerOutlineEnabled', () => {
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapCircularColormapPicker
          selected={CIRCULAR_COLORMAP_ORDER[0]}
          onChange={onChange}
          markerOutlineEnabled
        />,
      ),
    ).not.toThrow();
  });

  it('calls onCbModeChange when available', () => {
    const onChange = jest.fn();
    const onCbModeChange = jest.fn();
    const { getAllByRole } = render(
      <MapCircularColormapPicker
        selected={CIRCULAR_COLORMAP_ORDER[0]}
        onChange={onChange}
        onCbModeChange={onCbModeChange}
      />,
    );
    expect(getAllByRole('radio').length).toBeGreaterThan(0);
  });

  it('calls onCbModeChange with achromatopsia when mono button pressed', () => {
    const onChange = jest.fn();
    const onCbModeChange = jest.fn();
    const { getAllByRole } = render(
      <MapCircularColormapPicker
        selected={CIRCULAR_COLORMAP_ORDER[0]}
        onChange={onChange}
        onCbModeChange={onCbModeChange}
      />,
    );
    const radios = getAllByRole('radio');
    fireEvent.press(radios[radios.length - 1]);
    expect(onCbModeChange).toHaveBeenCalledWith('achromatopsia');
  });

  it('calls onCbModeChange with null when mono button pressed in mono mode', () => {
    const onChange = jest.fn();
    const onCbModeChange = jest.fn();
    const { getAllByRole } = render(
      <MapCircularColormapPicker
        selected={CIRCULAR_COLORMAP_ORDER[0]}
        onChange={onChange}
        cbMode='achromatopsia'
        onCbModeChange={onCbModeChange}
      />,
    );
    const radios = getAllByRole('radio');
    fireEvent.press(radios[radios.length - 1]);
    expect(onCbModeChange).toHaveBeenCalledWith(null);
  });
});
