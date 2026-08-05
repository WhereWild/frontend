// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { UploadPreview } from '@/components/upload/UploadPreview';

jest.mock('@/components', () => {
  const ReactLocal = jest.requireActual('react') as typeof import('react');
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    SpeciesEnvironmentSection: (props: {
      pinnedObservation?: {
        catalogNumber: string;
        lat: number;
        lon: number;
      } | null;
      polygon?: string | null;
    }) => {
      return ReactLocal.createElement(
        View,
        null,
        ReactLocal.createElement(
          Text,
          { testID: 'upload-preview-pinned-observation' },
          props.pinnedObservation
            ? props.pinnedObservation.catalogNumber
            : 'none',
        ),
        ReactLocal.createElement(
          Text,
          { testID: 'upload-preview-polygon' },
          props.polygon ?? 'none',
        ),
      );
    },
    SpeciesOccurrenceMap: (props: {
      occurrences?: { catalogNumber: string }[];
      onPinObservation?: (
        catalogNumber: string,
        lat: number,
        lon: number,
      ) => void;
      onPolygonDrawn?: (polygons: [number, number][][]) => void;
      onPolygonCleared?: () => void;
    }) => {
      return ReactLocal.createElement(
        View,
        null,
        ReactLocal.createElement(
          Text,
          {
            testID: 'upload-preview-pin-trigger',
            onPress: () => props.onPinObservation?.('obs_1', 10, 20),
          },
          'pin',
        ),
        ReactLocal.createElement(
          Text,
          { testID: 'upload-preview-occurrence-count' },
          String(props.occurrences?.length ?? 0),
        ),
        ReactLocal.createElement(
          Text,
          {
            testID: 'upload-preview-draw-trigger',
            // A single square covering only the "inside" fixture point —
            // see the polygon-filtering test below.
            onPress: () =>
              props.onPolygonDrawn?.([
                [
                  [0, 0],
                  [0, 10],
                  [10, 10],
                  [10, 0],
                ],
              ]),
          },
          'draw',
        ),
        ReactLocal.createElement(
          Text,
          {
            testID: 'upload-preview-erase-trigger',
            onPress: () => props.onPolygonCleared?.(),
          },
          'erase',
        ),
      );
    },
  };
});

describe('UploadPreview', () => {
  it('passes pinned observations from the uploaded map into the environment section', async () => {
    render(
      <UploadPreview
        highlightedCatalogs={[]}
        height={320}
        uploadedBundle={{
          categoricalStats: [],
          ordinalStats: [],
          densityGraph: [],
          occurrences: [
            { catalogNumber: 'obs_1', latitude: 10, longitude: 20 },
          ],
          occurrenceIndex: [],
          summaryStats: [],
        }}
        uploadedDataSource={
          {
            fetchSpeciesOccurrences: jest.fn().mockResolvedValue({
              occurrences: [],
              minTimestamp: null,
              maxTimestamp: null,
              phenologyCounts: null,
            }),
          } as never
        }
        onHighlightChange={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('upload-preview-pinned-observation').props.children,
    ).toBe('none');

    await act(async () => {
      fireEvent.press(screen.getByTestId('upload-preview-pin-trigger'));
    });

    expect(
      screen.getByTestId('upload-preview-pinned-observation').props.children,
    ).toBe('obs_1');
  });

  it('filters the map to a drawn polygon region and forwards it to the environment section', async () => {
    render(
      <UploadPreview
        highlightedCatalogs={[]}
        height={320}
        uploadedBundle={{
          categoricalStats: [],
          ordinalStats: [],
          densityGraph: [],
          occurrences: [
            { catalogNumber: 'obs_inside', latitude: 5, longitude: 5 },
            { catalogNumber: 'obs_outside', latitude: 50, longitude: 50 },
          ],
          occurrenceIndex: [],
          summaryStats: [],
        }}
        uploadedDataSource={
          {
            fetchSpeciesOccurrences: jest.fn().mockResolvedValue({
              occurrences: [
                { catalogNumber: 'obs_inside', latitude: 5, longitude: 5 },
                { catalogNumber: 'obs_outside', latitude: 50, longitude: 50 },
              ],
              minTimestamp: null,
              maxTimestamp: null,
              phenologyCounts: null,
            }),
          } as never
        }
        onHighlightChange={jest.fn()}
      />,
    );

    await act(async () => {});

    expect(
      screen.getByTestId('upload-preview-occurrence-count').props.children,
    ).toBe('2');
    expect(screen.getByTestId('upload-preview-polygon').props.children).toBe(
      'none',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('upload-preview-draw-trigger'));
    });

    // Only obs_inside falls within the drawn square — the map's occurrences
    // prop should drop to 1, and the environment section should now get a
    // real encoded `polygon` string instead of null. This is the exact bug
    // reported: drawing a region on the upload page didn't filter anything,
    // because nothing wired the map's onPolygonDrawn callback at all.
    expect(
      screen.getByTestId('upload-preview-occurrence-count').props.children,
    ).toBe('1');
    expect(
      screen.getByTestId('upload-preview-polygon').props.children,
    ).not.toBe('none');

    await act(async () => {
      fireEvent.press(screen.getByTestId('upload-preview-erase-trigger'));
    });

    expect(
      screen.getByTestId('upload-preview-occurrence-count').props.children,
    ).toBe('2');
    expect(screen.getByTestId('upload-preview-polygon').props.children).toBe(
      'none',
    );
  });
});
