import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SpeciesEnvironmentSection } from '../SpeciesEnvironmentSection';
import { fetchSpeciesEnvironment } from '@/data/api';
import type { SpeciesEnvironmentStats } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useMeasurementPreferences } from '@/hooks/useMeasurementPreferences';

jest.mock('@/data/api', () => ({
  fetchSpeciesEnvironment: jest.fn(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

jest.mock('@/hooks/useMeasurementPreferences', () => ({
  useMeasurementPreferences: jest.fn(() => ({
    lengthUnits: 'metric',
    rainfallUnits: 'metric',
    temperatureUnits: 'celsius',
    setLengthUnits: jest.fn(),
    setRainfallUnits: jest.fn(),
    setTemperatureUnits: jest.fn(),
    resetLengthUnits: jest.fn(),
    resetRainfallUnits: jest.fn(),
    resetTemperatureUnits: jest.fn(),
    snapshot: {
      lengthUnits: 'metric',
      rainfallUnits: 'metric',
      temperatureUnits: 'celsius',
    },
  })),
}));

const mockFetchSpeciesEnvironment = fetchSpeciesEnvironment as jest.MockedFunction<typeof fetchSpeciesEnvironment>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;
const mockUseMeasurementPreferences = useMeasurementPreferences as jest.MockedFunction<typeof useMeasurementPreferences>;

const desktopResponsive = {
  width: 1280,
  height: 720,
  scale: 1,
  fontScale: 1,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isCompact: false,
};

const compactTabletResponsive = {
  width: 600,
  height: 800,
  scale: 1,
  fontScale: 1,
  isMobile: false,
  isTablet: true,
  isDesktop: false,
  isCompact: true,
};

const createContinuousStats = (
  overrides: Partial<SpeciesEnvironmentStats> = {},
): SpeciesEnvironmentStats => {
  const { summary: summaryOverride, ...rest } = overrides;
  const summary = {
    count: 24,
    mean: 12.5,
    stddev: 4.2,
    q10: 3.5,
    q90: 20.1,
    ...summaryOverride,
  };

  const base: SpeciesEnvironmentStats = {
    speciesId: 42,
    variable: 'soil_moisture',
    variableName: 'Soil moisture',
    units: 'mm',
    variableType: 'continuous',
    generatedAt: '2024-01-01T00:00:00Z',
    summary,
    histogram: { bins: [0, 10, 20], counts: [8, 16] },
    binSamples: [{ index: 1, observationIds: [101, 202, '303'] }],
    categoricalDistribution: [],
    dominantCategories: [],
    categoricalSamples: [],
  };

  return {
    ...base,
    ...rest,
    summary,
  };
};

const createCategoricalStats = (): SpeciesEnvironmentStats =>
  createContinuousStats({
    variable: 'landcover',
    variableName: 'Landcover',
    variableType: 'categorical',
    summary: {
      count: 54,
      mean: null,
      stddev: null,
      q10: null,
      q90: null,
    },
    histogram: null,
    binSamples: [],
    categoricalDistribution: [
      { value: 1, className: 'Forest', count: 30, fraction: 0.6 },
      { value: 2, className: 'Grassland', count: 20, fraction: 0.4 },
    ],
    dominantCategories: [
      { value: 1, className: 'Forest', count: 30, fraction: 0.6 },
    ],
    categoricalSamples: [
      { value: 1, observationIds: [901, 902] },
      { value: 2, observationIds: [] },
    ],
  });

describe('SpeciesEnvironmentSection', () => {
  const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue(desktopResponsive);
    mockUseMeasurementPreferences.mockReturnValue({
      lengthUnits: 'metric',
      rainfallUnits: 'metric',
      temperatureUnits: 'celsius',
      setLengthUnits: jest.fn(),
      setRainfallUnits: jest.fn(),
      setTemperatureUnits: jest.fn(),
      resetLengthUnits: jest.fn(),
      resetRainfallUnits: jest.fn(),
      resetTemperatureUnits: jest.fn(),
      snapshot: {
        lengthUnits: 'metric',
        rainfallUnits: 'metric',
        temperatureUnits: 'celsius',
      },
    });
  });

  it('renders nothing when no taxon id is provided', () => {
    const { toJSON } = render(<SpeciesEnvironmentSection />);

    expect(toJSON()).toBeNull();
    expect(mockFetchSpeciesEnvironment).not.toHaveBeenCalled();
  });

  it('renders prefetched histogram stats and opens observation links', () => {
    const stats = createContinuousStats();

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
        title="Soil Moisture"
      />,
    );

    expect(mockFetchSpeciesEnvironment).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('histogram-bar-1'));

    expect(screen.getByText('Observations in 10 to 20')).toBeTruthy();
    fireEvent.press(screen.getByText('#101'));
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/101',
    );
  });

  it('shows a placeholder when histogram data is unavailable', () => {
    const stats = createContinuousStats({
      histogram: { bins: [], counts: [] },
      binSamples: [],
    });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    expect(screen.getByText('Histogram data unavailable.')).toBeTruthy();
  });

  it('downsamples histograms that exceed the display limit', () => {
    const counts = Array.from({ length: 20 }, (_, index) => index + 1);
    const bins = Array.from({ length: counts.length + 1 }, (_, index) => index * 5);
    const stats = createContinuousStats({
      histogram: { bins, counts },
      binSamples: [],
    });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    const histogramBars = screen.getAllByTestId(/histogram-bar-/);
    expect(histogramBars).toHaveLength(12);
  });

  it('rotates the histogram horizontally on compact breakpoints', () => {
    const stats = createContinuousStats();
    mockUseResponsive.mockReturnValue(compactTabletResponsive);

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    expect(screen.getByTestId('histogram-horizontal-track-0')).toBeTruthy();
  });

  it('fetches stats when prefetched data is unavailable and shows loading state', async () => {
    const stats = createContinuousStats({ speciesId: 77, variable: 'elevation' });
    mockFetchSpeciesEnvironment.mockResolvedValue(stats);

    render(
      <SpeciesEnvironmentSection
        taxonId={77}
        variableId="elevation"
        title="Elevation"
      />,
    );

    expect(screen.getByText('Loading environment data…')).toBeTruthy();
    await screen.findByTestId('histogram-bar-0');

    expect(mockFetchSpeciesEnvironment).toHaveBeenCalledWith(77, 'elevation');
  });

  it('defaults the variable id when none is provided', async () => {
    const stats = createContinuousStats({ speciesId: 88, variable: 'elevation' });
    mockFetchSpeciesEnvironment.mockResolvedValue(stats);

    render(<SpeciesEnvironmentSection taxonId={88} />);

    await screen.findByTestId('histogram-bar-0');
    expect(mockFetchSpeciesEnvironment).toHaveBeenCalledWith(88, 'elevation');
  });

  it('surfaces backend errors when the fetch rejects', async () => {
    mockFetchSpeciesEnvironment.mockRejectedValue(new Error('Outage'));

    render(<SpeciesEnvironmentSection taxonId={55} variableId="elevation" />);
    expect(await screen.findByText('Outage')).toBeTruthy();
  });

  it('falls back to a generic error message when rejection is not an Error instance', async () => {
    mockFetchSpeciesEnvironment.mockRejectedValue('nope');

    render(<SpeciesEnvironmentSection taxonId={99} variableId="elevation" />);
    expect(await screen.findByText('Failed to load environment stats')).toBeTruthy();
  });

  it('renders categorical distributions and toggles observation panels', () => {
    const stats = createCategoricalStats();

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
        title="Landcover"
      />,
    );

    expect(screen.getByText('Forest')).toBeTruthy();

    const toggle = screen.getByTestId('category-toggle-1');
    fireEvent.press(toggle);
    expect(screen.getByText('Observations in Forest')).toBeTruthy();
    fireEvent.press(screen.getByText('#901'));
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/901',
    );

    fireEvent.press(toggle);
    expect(screen.queryByText('Observations in Forest')).toBeNull();
  });

  it('shows a fallback message when selected histogram bins lack samples', () => {
    const stats = createContinuousStats({ binSamples: [] });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    fireEvent.press(screen.getByTestId('histogram-bar-0'));
    expect(screen.getByText('No observations recorded.')).toBeTruthy();
  });

  it('handles bin sample payloads that are not arrays', () => {
    const stats = createContinuousStats({
      binSamples: [{ index: 0, observationIds: null } as any],
    });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    fireEvent.press(screen.getByTestId('histogram-bar-0'));
    expect(screen.getByText('No observations recorded.')).toBeTruthy();
  });

  it('handles invalid histogram bins and zero totals gracefully', () => {
    const stats = createContinuousStats({
      summary: {
        count: 0,
        mean: 12.5,
        stddev: 4.2,
        q10: 3.5,
        q90: 20.1,
      },
      histogram: { bins: [Number.NaN, 10, 20], counts: [5, 15] },
    });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const firstBar = screen.getByTestId('histogram-bar-0');
    fireEvent.press(firstBar);
    const tooltipMatcher = /— • Samples 5 \(0%\)/i;
    expect(screen.getByText(tooltipMatcher)).toBeTruthy();

    fireEvent(firstBar, 'hoverIn');
    expect(screen.getByText(tooltipMatcher)).toBeTruthy();

    fireEvent(firstBar, 'hoverOut');
    expect(screen.getByText(tooltipMatcher)).toBeTruthy();
  });

  it('shows landcover fallback when categorical stats lack distribution data', () => {
    const stats = createContinuousStats({
      variable: 'landcover',
      variableName: 'Landcover',
      variableType: 'categorical',
      categoricalDistribution: [],
      histogram: null,
      binSamples: [],
    });

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    expect(screen.getByText('Landcover categories unavailable.')).toBeTruthy();
  });

  it('normalizes invalid category fractions to 0% of samples', () => {
    const categoricalStats = createCategoricalStats();
    const stats = {
      ...categoricalStats,
      categoricalDistribution: (categoricalStats.categoricalDistribution ?? []).map(
        (entry, index) => (index === 0 ? { ...entry, fraction: Number.NaN } : entry),
      ),
    };

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    expect(screen.getByText('0% • 30 samples')).toBeTruthy();
  });

  it('treats categorical sample payloads without arrays as non-interactive', () => {
    const stats = createCategoricalStats();
    const patched = {
      ...stats,
      categoricalSamples: [{ value: 1, observationIds: null }] as any,
    };

    render(
      <SpeciesEnvironmentSection
        taxonId={patched.speciesId}
        variableId={patched.variable}
        initialStats={patched}
      />,
    );

    expect(screen.queryByTestId('category-toggle-1')).toBeNull();
    expect(screen.getByText('Forest')).toBeTruthy();
  });

  it('ignores blank observation IDs and warns when deep links fail', async () => {
    const stats = createContinuousStats({
      binSamples: [{ index: 0, observationIds: ['   ', '404'] }],
    });
    openUrlSpy.mockRejectedValueOnce(new Error('nope'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <SpeciesEnvironmentSection
        taxonId={stats.speciesId}
        variableId={stats.variable}
        initialStats={stats}
      />,
    );

    fireEvent.press(screen.getByTestId('histogram-bar-0'));
    fireEvent.press(screen.getByText('#404'));

    await waitFor(() => {
      expect(openUrlSpy).toHaveBeenCalledWith(
        'https://www.inaturalist.org/observations/404',
      );
      expect(warnSpy).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText('#'));
    expect(openUrlSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
