// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type * as DocumentPicker from 'expo-document-picker';
import { Colors } from '@/constants/theme';
import { findCustomLayersMissingMetadata } from '@/components/upload/customLayers';
import { selectFilesFromPicker } from '@/hooks/upload/uploadWorkflowHelpers';
import { CustomLayersField } from '../CustomLayersField';

jest.mock('@/components/upload/customLayers', () => ({
  findCustomLayersMissingMetadata: jest.fn(),
}));
jest.mock('@/hooks/upload/uploadWorkflowHelpers', () => {
  const actual = jest.requireActual('@/hooks/upload/uploadWorkflowHelpers');
  return { ...actual, selectFilesFromPicker: jest.fn() };
});

const mockFindMissing = jest.mocked(findCustomLayersMissingMetadata);
const mockSelectFiles = jest.mocked(selectFilesFromPicker);

const asset = (name: string): DocumentPicker.DocumentPickerAsset =>
  ({
    name,
    uri: `file://${name}`,
  }) as unknown as DocumentPicker.DocumentPickerAsset;

describe('CustomLayersField', () => {
  beforeEach(() => {
    mockFindMissing.mockReset();
    mockFindMissing.mockResolvedValue([]);
    mockSelectFiles.mockReset();
  });

  it('renders no attached layers or warning when value is empty', () => {
    render(
      <CustomLayersField
        value={[]}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );
    expect(screen.getByText('Add custom layer')).toBeTruthy();
    expect(screen.queryByText(/Warning:/)).toBeNull();
  });

  it('lists each attached layer with a Remove button', async () => {
    render(
      <CustomLayersField
        value={[asset('a.tif'), asset('b.geojson')]}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('a.tif')).toBeTruthy();
    expect(screen.getByText('b.geojson')).toBeTruthy();
    expect(screen.getAllByText('Remove')).toHaveLength(2);
  });

  it('adds a picked file to the list', async () => {
    mockSelectFiles.mockResolvedValueOnce({ files: [asset('new.tif')] });
    const handleChange = jest.fn();
    render(
      <CustomLayersField
        value={[]}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add custom layer'));
      await Promise.resolve();
    });

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'new.tif' }),
    ]);
  });

  it('adds every file from a single multi-select pick, appended to what was already attached', async () => {
    mockSelectFiles.mockResolvedValueOnce({
      files: [asset('b.tif'), asset('c.geojson')],
    });
    const handleChange = jest.fn();
    render(
      <CustomLayersField
        value={[asset('a.tif')]}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add custom layer'));
      await Promise.resolve();
    });

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'a.tif' }),
      expect.objectContaining({ name: 'b.tif' }),
      expect.objectContaining({ name: 'c.geojson' }),
    ]);
  });

  it('replaces an existing layer instead of duplicating it when re-picked by the same name', async () => {
    mockSelectFiles.mockResolvedValueOnce({
      files: [asset('a.tif')],
    });
    const handleChange = jest.fn();
    render(
      <CustomLayersField
        value={[asset('a.tif'), asset('b.tif')]}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add custom layer'));
      await Promise.resolve();
    });

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'b.tif' }),
      expect.objectContaining({ name: 'a.tif' }),
    ]);
  });

  it('shows a picker error instead of adding a file on an invalid selection', async () => {
    mockSelectFiles.mockResolvedValueOnce({
      errorMessage: 'Unsupported file type.',
    });
    const handleChange = jest.fn();
    render(
      <CustomLayersField
        value={[]}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add custom layer'));
      await Promise.resolve();
    });

    expect(handleChange).not.toHaveBeenCalled();
    expect(await screen.findByText('Unsupported file type.')).toBeTruthy();
  });

  it('removes a layer by name', async () => {
    const handleChange = jest.fn();
    render(
      <CustomLayersField
        value={[asset('a.tif'), asset('b.tif')]}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(screen.getAllByText('Remove')[0]);

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'b.tif' }),
    ]);
  });

  it('shows a warning listing layers missing metadata, with a link to the GIS editor', async () => {
    mockFindMissing.mockResolvedValueOnce(['bad.tif', 'bad2.geojson']);
    render(
      <CustomLayersField
        value={[asset('bad.tif'), asset('bad2.geojson')]}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    expect(
      await screen.findByText(/Warning: metadata not detected/),
    ).toBeTruthy();
    expect(screen.getByText('GIS Editor')).toBeTruthy();
  });

  it('does not show a warning when every attached layer has metadata', async () => {
    mockFindMissing.mockResolvedValueOnce([]);
    render(
      <CustomLayersField
        value={[asset('good.tif')]}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(/Warning:/)).toBeNull();
  });
});
