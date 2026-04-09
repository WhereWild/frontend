import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { UploadPreview } from '@/components/upload/UploadPreview';

jest.mock('@/components', () => {
  const ReactLocal = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');

  return {
    SpeciesEnvironmentSection: (props: {
      pinnedObservation?: { catalogNumber: string; lat: number; lon: number } | null;
    }) => {
      return ReactLocal.createElement(
        Text,
        { testID: 'upload-preview-pinned-observation' },
        props.pinnedObservation ? props.pinnedObservation.catalogNumber : 'none',
      );
    },
    SpeciesOccurrenceMap: (props: {
      onPinObservation?: (catalogNumber: string, lat: number, lon: number) => void;
    }) => {
      return ReactLocal.createElement(
        Text,
        {
          testID: 'upload-preview-pin-trigger',
          onPress: () => props.onPinObservation?.('obs_1', 10, 20),
        },
        'pin',
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
          densityGraph: [],
          occurrences: [
            { catalogNumber: 'obs_1', latitude: 10, longitude: 20 },
          ],
          occurrenceIndex: [],
          summaryStats: [],
        }}
        uploadedDataSource={{} as never}
        onHighlightChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('upload-preview-pinned-observation').props.children).toBe('none');

    await act(async () => {
      fireEvent.press(screen.getByTestId('upload-preview-pin-trigger'));
    });

    expect(screen.getByTestId('upload-preview-pinned-observation').props.children).toBe('obs_1');
  });
});