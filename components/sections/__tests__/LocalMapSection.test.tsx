import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LocalMapSection } from '../LocalMapSection';

jest.mock('../SpeciesOccurrenceMap', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

  return {
    SpeciesOccurrenceMap: ({
      heatmapTileUrl,
      height,
      initialLat,
      initialLon,
      initialZoom,
      maxBounds,
      maxZoom,
      minZoom,
      showMarkers,
    }: {
      heatmapTileUrl?: string | null;
      height?: number;
      initialLat?: number;
      initialLon?: number;
      initialZoom?: number;
      maxBounds?: [[number, number], [number, number]] | null;
      maxZoom?: number | null;
      minZoom?: number;
      showMarkers?: boolean;
    }) => (
      <View>
        <Text testID='map-heatmap-url'>{heatmapTileUrl ?? 'none'}</Text>
        <Text testID='map-height'>{String(height)}</Text>
        <Text testID='map-initial-lat'>{String(initialLat)}</Text>
        <Text testID='map-initial-lon'>{String(initialLon)}</Text>
        <Text testID='map-initial-zoom'>{String(initialZoom)}</Text>
        <Text testID='map-min-zoom'>{String(minZoom)}</Text>
        <Text testID='map-max-zoom'>{String(maxZoom)}</Text>
        <Text testID='map-show-markers'>
          {showMarkers === false ? 'hidden' : 'shown'}
        </Text>
        <Text testID='map-max-bounds'>{JSON.stringify(maxBounds)}</Text>
      </View>
    ),
  };
});

describe('LocalMapSection', () => {
  it('renders the heading and passes the expected map configuration', () => {
    render(
      <LocalMapSection heatmapTileUrl='https://tiles.example.test/{z}/{x}/{y}.png' />,
    );

    expect(screen.getByText('Local Map')).toBeTruthy();
    expect(screen.getByTestId('map-heatmap-url').props.children).toBe(
      'https://tiles.example.test/{z}/{x}/{y}.png',
    );
    expect(screen.getByTestId('map-height').props.children).toBe('640');
    expect(screen.getByTestId('map-initial-lat').props.children).toBe('39.5');
    expect(screen.getByTestId('map-initial-lon').props.children).toBe('-98.35');
    expect(screen.getByTestId('map-initial-zoom').props.children).toBe('4');
    expect(screen.getByTestId('map-min-zoom').props.children).toBe('5');
    expect(screen.getByTestId('map-max-zoom').props.children).toBe('9');
    expect(screen.getByTestId('map-show-markers').props.children).toBe(
      'hidden',
    );
    expect(screen.getByTestId('map-max-bounds').props.children).toContain(
      '-135',
    );
  });

  it('omits the heading when showHeading is false', () => {
    render(<LocalMapSection showHeading={false} />);

    expect(screen.queryByText('Local Map')).toBeNull();
  });
});
