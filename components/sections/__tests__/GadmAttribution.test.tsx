import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import React from 'react';
import { GadmAttribution } from '../GadmAttribution';
import { useDataSources } from '@/hooks/useDataSources';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: jest.fn(),
}));

const mockUseDataSources = useDataSources as jest.MockedFunction<
  typeof useDataSources
>;

describe('GadmAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataSources.mockReturnValue({});
  });

  it('returns null when the GADM source is unavailable', () => {
    const { queryByText } = render(<GadmAttribution />);

    expect(queryByText('Data page')).toBeNull();
  });

  it('renders data page and optional license links', async () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);
    mockUseDataSources.mockReturnValue({
      gadm: {
        name: 'GADM',
        url: 'https://gadm.example/data',
        license: 'CC BY-NC 4.0',
        license_url: 'https://gadm.example/license',
        references: [],
      },
    });

    render(<GadmAttribution />);

    expect(screen.getByText('Location boundaries: GADM ')).toBeTruthy();
    fireEvent.press(screen.getByText('Data page'));
    fireEvent.press(screen.getByText('License'));

    expect(openUrlSpy).toHaveBeenNthCalledWith(1, 'https://gadm.example/data');
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      2,
      'https://gadm.example/license',
    );
  });

  it('omits the license link when no license URL is provided', () => {
    mockUseDataSources.mockReturnValue({
      gadm: {
        name: 'GADM',
        url: 'https://gadm.example/data',
        license: 'CC BY-NC 4.0',
        license_url: null,
        references: [],
      },
    });

    render(<GadmAttribution />);

    expect(screen.getByText('Data page')).toBeTruthy();
    expect(screen.queryByText('License')).toBeNull();
  });

  it('omits the data page link when the source url is empty', () => {
    mockUseDataSources.mockReturnValue({
      gadm: {
        name: 'GADM',
        url: '',
        license: 'CC BY-NC 4.0',
        license_url: 'https://gadm.example/license',
        references: [],
      },
    });

    render(<GadmAttribution />);

    expect(screen.getByText('Location boundaries: GADM ')).toBeTruthy();
    expect(screen.queryByText('Data page')).toBeNull();
    expect(screen.getByText('License')).toBeTruthy();
  });

  it('renders plain source text when no links are available', () => {
    mockUseDataSources.mockReturnValue({
      gadm: {
        name: 'GADM',
        url: '',
        license: 'CC BY-NC 4.0',
        license_url: null,
        references: [],
      },
    });

    render(<GadmAttribution />);

    expect(screen.getByText('Location boundaries: GADM')).toBeTruthy();
    expect(screen.queryByText('Data page')).toBeNull();
    expect(screen.queryByText('License')).toBeNull();
  });
});
