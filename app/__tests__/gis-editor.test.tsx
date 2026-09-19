// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import GisEditorRoute from '../gis-editor';
import {
  inspectRaster,
  deriveRenderBounds,
} from '@/components/gisEditor/rasterMetadata';
import { createCogTileRenderer } from '@/components/gisEditor/cogTileRenderer';
import {
  resolveAssetBlob,
  selectFileFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers';

const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/gis-editor',
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'desktop',
    contentWidth: 960,
    gap: 16,
    marginHorizontal: 24,
  }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => undefined),
}));

jest.mock('@/hooks/upload/uploadWorkflowHelpers', () => ({
  selectFileFromPicker: jest.fn(async () => ({})),
  resolveAssetBlob: jest.fn(async () => new Blob()),
}));

// The map + the GeoTIFF renderer are exercised in their own suites.
jest.mock('@/components/sections/VariableHeatmapMap', () => ({
  VariableHeatmapMap: () => null,
}));
jest.mock('@/components/gisEditor/cogTileRenderer', () => ({
  createCogTileRenderer: jest.fn(),
}));
jest.mock('@/components/gisEditor/rasterMetadata', () => ({
  inspectRaster: jest.fn(),
  deriveRenderBounds: jest.fn(),
  deriveDetectedValueType: jest.fn(async () => null),
}));

const originalOS = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalOS,
  });
  mockRedirect.mockClear();
});

describe('GisEditorRoute', () => {
  it('redirects to home on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    render(<GisEditorRoute />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('renders the drop zone on web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    render(<GisEditorRoute />);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Choose file')).toBeTruthy();
    expect(screen.getByText('No file loaded')).toBeTruthy();
  });

  it('lets the file dialog pick a GeoJSON as well as a GeoTIFF', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    render(<GisEditorRoute />);
    fireEvent.press(screen.getByText('Choose file'));

    await waitFor(() => expect(selectFileFromPicker).toHaveBeenCalled());
    const config = (selectFileFromPicker as jest.Mock).mock.calls.at(-1)[0];
    // A GeoJSON usually has no MIME type a file dialog recognizes, so this
    // can't be a GeoTIFF-only MIME allowlist.
    expect(config.pickerType).toBe('*/*');
    expect(config.allowedExtensions).toEqual(
      expect.arrayContaining(['.tif', '.tiff', '.geojson', '.json']),
    );
  });

  it('opens a picked .geojson in the vector editor instead of treating it as a raster', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            ],
          },
          properties: { LAND_USE: 'Forest' },
        },
      ],
    });
    (selectFileFromPicker as jest.Mock).mockResolvedValueOnce({
      file: { name: 'utah_l4.geojson' },
    });
    (resolveAssetBlob as jest.Mock).mockResolvedValueOnce(new Blob([geojson]));
    (inspectRaster as jest.Mock).mockClear();

    render(<GisEditorRoute />);
    fireEvent.press(screen.getByText('Choose file'));

    expect(await screen.findByText('utah_l4.geojson')).toBeTruthy();
    expect(screen.getByTestId('gis-vector-display-name')).toBeTruthy();
    expect(inspectRaster).not.toHaveBeenCalled();
  });

  it('gates rendering behind a warning when the COG checklist fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    (selectFileFromPicker as jest.Mock).mockResolvedValueOnce({
      file: { name: 'huge.tif' },
    });
    (inspectRaster as jest.Mock).mockResolvedValueOnce({
      width: 43202,
      height: 21384,
      tiled: true,
      tileWidth: 256,
      tileHeight: 256,
      bandCount: 1,
      dtype: 'float64',
      compression: 'LZW',
      noData: null,
      epsg: 4326,
      crsLabel: 'EPSG:4326',
      geoKeys: {},
      resolution: [0.0083, 0.0083],
      bbox: [-180, -89, 180, 89],
      bigTiff: true,
      overviews: [],
      cog: {
        isCog: false,
        checks: [{ label: 'Has overviews', pass: false, detail: 'None' }],
      },
    });
    (deriveRenderBounds as jest.Mock).mockResolvedValueOnce({
      min: 0,
      max: 1,
      approximate: true,
    });

    (createCogTileRenderer as jest.Mock).mockResolvedValueOnce({
      renderTile: jest.fn(),
      view: { lat: 0, lon: 0, zoom: 2 },
      dispose: jest.fn(),
    });

    render(<GisEditorRoute />);
    fireEvent.press(screen.getByText('Choose file'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'This file fails the Cloud-Optimized GeoTIFF checklist above.',
        ),
      ).toBeTruthy(),
    );
    expect(createCogTileRenderer).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Render anyway'));
    await waitFor(() => expect(createCogTileRenderer).toHaveBeenCalledTimes(1));
  });
});
