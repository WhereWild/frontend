// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MetadataEditor } from '../MetadataEditor';
import { VectorEditor } from '../VectorEditor';
import type { RasterEditableMeta } from '../rasterEditableMeta';
import type { VectorMetadata } from '../shapefileMetadata';
import type { VectorEditableMeta } from '../vectorEditableMeta';

describe('Display name field', () => {
  it('raster editor: shows the current name and reports edits through onChange', () => {
    const editable: RasterEditableMeta = {
      displayName: 'Soil salinity',
      valueType: 'ratio',
      units: '',
      renderMin: 0,
      renderMax: 1,
      scale: 1,
      offset: 0,
      classes: [],
    };
    const onChange = jest.fn();
    render(
      <MetadataEditor
        editable={editable}
        detectedType={null}
        rawBounds={{ min: 0, max: 1, approximate: false }}
        onChange={onChange}
        onValueTypeChange={jest.fn()}
      />,
    );

    const input = screen.getByTestId('gis-metadata-display-name');
    expect(input.props.value).toBe('Soil salinity');

    fireEvent.changeText(input, 'Salinity');
    expect(onChange).toHaveBeenCalledWith({
      ...editable,
      displayName: 'Salinity',
    });
  });

  it('vector editor: shows the current name and reports edits through onChange', () => {
    const editable: VectorEditableMeta = {
      displayName: 'Ecoregions',
      mode: 'single',
      color: '#3388ff',
      field: null,
      classes: [],
    };
    const metadata = {
      featureCount: 1,
      geometryType: 'Polygon',
      vertexCount: 4,
      fields: [],
      bbox: null,
      crsLabel: 'WGS84',
      savedConfig: null,
      cachedOverviewLevels: null,
    } as VectorMetadata;
    const onChange = jest.fn();
    render(
      <VectorEditor
        metadata={metadata}
        editable={editable}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('gis-vector-display-name');
    expect(input.props.value).toBe('Ecoregions');

    fireEvent.changeText(input, 'Utah ecoregions');
    expect(onChange).toHaveBeenCalledWith({
      ...editable,
      displayName: 'Utah ecoregions',
    });
  });
});
