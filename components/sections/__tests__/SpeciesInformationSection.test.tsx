import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import React from 'react';
import { SpeciesInformationSection } from '../SpeciesInformationSection';
import { useDataSources } from '@/hooks/useDataSources';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: jest.fn(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseDataSources = useDataSources as jest.MockedFunction<
  typeof useDataSources
>;
const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;

describe('SpeciesInformationSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseResponsive.mockReturnValue({ textWidth: 640 } as ReturnType<
      typeof useResponsive
    >);
    mockUseDataSources.mockReturnValue({});
  });

  it('renders structured overview content and opens attribution links', () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);
    mockUseDataSources.mockReturnValue({
      gbif_inaturalist: {
        name: 'GBIF',
        url: 'https://gbif.example/citation',
        license: 'CC BY 4.0',
        references: [],
      },
    });

    render(
      <SpeciesInformationSection
        commonName='Test Cactus'
        commonNames={['Test Cactus', 'Spiny Test Cactus']}
        overview={{
          description: 'Ignored fallback',
          imageSource: { uri: 'https://images.example/cactus.jpg' },
          imageLicense: 'CC BY-SA 4.0',
          imageCreator: '  Jane Example  ',
          imageReferences: '/observations/12345',
          sections: [
            {
              id: 'habitat',
              title: 'Habitat',
              lines: [
                { body: 'Open desert slopes' },
                { prefix: 'Range:', body: ' Southwestern basins ' },
                { prefix: 'Skip', body: '   ' },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Habitat')).toBeTruthy();
    expect(screen.getByText('Open desert slopes')).toBeTruthy();
    expect(screen.getByText('Range: Southwestern basins')).toBeTruthy();
    expect(screen.getByText('Photo by Jane Example')).toBeTruthy();
    expect(screen.getByText('CC BY-SA 4.0')).toBeTruthy();
    expect(screen.getByText('Occurrence data: GBIF ')).toBeTruthy();

    fireEvent.press(screen.getByText('View on iNaturalist'));
    fireEvent.press(screen.getByText('View citation'));

    expect(openUrlSpy).toHaveBeenNthCalledWith(
      1,
      'https://www.inaturalist.org/observations/12345',
    );
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      2,
      'https://gbif.example/citation',
    );
  });

  it('falls back to description text and omits optional attribution links when URLs are absent', () => {
    mockUseDataSources.mockReturnValue({
      gbif_inaturalist: {
        name: 'GBIF',
        url: '',
        license: 'CC BY 4.0',
        references: [],
      },
    });

    render(
      <SpeciesInformationSection
        commonName='Test Cactus'
        commonNames={['Test Cactus']}
        overview={{
          description: 'Fallback overview description.',
          imageSource: { uri: 'https://images.example/cactus.jpg' },
        }}
      />,
    );

    expect(screen.getByText('Fallback overview description.')).toBeTruthy();
    expect(screen.getByText('Occurrence data: GBIF')).toBeTruthy();
    expect(screen.queryByText('View citation')).toBeNull();
    expect(screen.queryByText('View on iNaturalist')).toBeNull();
    expect(screen.queryByText(/Photo by/)).toBeNull();
  });
});
