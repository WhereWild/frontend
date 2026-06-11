// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapColormapPicker } from '../speciesOccurrenceMap/MapColormapPicker';
import { COLORMAP_ORDER } from '../speciesOccurrenceMap/variableColors';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

describe('MapColormapPicker', () => {
  it('renders all colormap options', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapColormapPicker selected={COLORMAP_ORDER[0]} onChange={onChange} />,
    );
    const radios = getAllByRole('radio');
    expect(radios.length).toBe(COLORMAP_ORDER.length);
  });

  it('marks the selected colormap as selected', () => {
    const onChange = jest.fn();
    const selected = COLORMAP_ORDER[0];
    const { getAllByRole } = render(
      <MapColormapPicker selected={selected} onChange={onChange} />,
    );
    const radios = getAllByRole('radio');
    const selectedRadio = radios.find(
      (r) => r.props.accessibilityState?.selected,
    );
    expect(selectedRadio).toBeTruthy();
  });

  it('calls onChange when a colormap is pressed', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <MapColormapPicker selected={COLORMAP_ORDER[0]} onChange={onChange} />,
    );
    fireEvent.press(getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith(COLORMAP_ORDER[1]);
  });

  it('renders in light mode', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const onChange = jest.fn();
    expect(() =>
      render(
        <MapColormapPicker selected={COLORMAP_ORDER[0]} onChange={onChange} />,
      ),
    ).not.toThrow();
  });
});
